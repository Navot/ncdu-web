import { useEffect, useRef, useState, useCallback } from 'react';
import { Container, Title, Paper, Group, Text, Loader, Button } from '@mantine/core';
import { IconTrash, IconRefresh, IconArrowLeft } from '@tabler/icons-react';
import * as d3 from 'd3';
import { useParams, useNavigate } from 'react-router-dom';
import { diskAPI, FileNode, normalizePath as apiNormalizePath } from '../api/disk';

// Detect platform for path handling
const isWindows = navigator.platform.toLowerCase().includes('win');
const pathSeparator = isWindows ? '\\' : '/';

function Treemap({ data }: { data: FileNode }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const navigate = useNavigate();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!svgRef.current) return;

    const updateDimensions = () => {
      const container = svgRef.current?.parentElement;
      if (container) {
        setDimensions({
          width: container.clientWidth,
          height: Math.max(400, container.clientWidth * 0.6)
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    if (!svgRef.current || dimensions.width === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const hierarchy = d3.hierarchy(data)
      .sum(d => (d as FileNode).size)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    const treemap = d3.treemap<FileNode>()
      .size([dimensions.width, dimensions.height])
      .paddingOuter(3)
      .paddingTop(19)
      .paddingInner(2)
      .round(true);

    const root = treemap(hierarchy);

    const colorScale = d3.scaleOrdinal(d3.schemeBlues[9]);

    // Create cells
    const cell = svg
      .selectAll('g')
      .data(root.descendants())
      .join('g')
      .attr('transform', d => `translate(${d.x0},${d.y0})`);

    // Add rectangles
    cell.append('rect')
      .attr('width', d => d.x1 - d.x0)
      .attr('height', d => d.y1 - d.y0)
      .attr('fill', d => colorScale(d.depth.toString()))
      .attr('fill-opacity', 0.6)
      .attr('stroke', '#fff')
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        if ((d.data as FileNode).type === 'directory') {
          navigate(`/analysis/${d.data.name}`);
        }
      });

    // Add labels
    cell.append('text')
      .attr('x', 3)
      .attr('y', 15)
      .attr('fill', 'black')
      .attr('font-size', '12px')
      .text(d => d.data.name)
      .style('pointer-events', 'none');

  }, [data, dimensions, navigate]);

  return (
    <svg
      ref={svgRef}
      width={dimensions.width}
      height={dimensions.height}
      style={{ display: 'block' }}
    />
  );
}

function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Function to ensure a path is properly formed based on platform
function normalizePath(pathParam: string): string {
  return apiNormalizePath(pathParam);
}

export default function Analysis() {
  const { path: pathParam = 'root' } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<FileNode | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  const actualPath = normalizePath(pathParam);
  
  const loadData = useCallback(async (forceRefresh: boolean) => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`Analyzing path: ${actualPath}`);
      const response = await diskAPI.analyzePath(actualPath, forceRefresh);
      setData(response.result);
      setLastUpdated(new Date(response.lastUpdated));
    } catch (err) {
      console.error('Error loading disk data:', err);
      setError('Failed to load disk data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [actualPath]);
  
  useEffect(() => {
    loadData(false);
    
    // Setup WebSocket connection for real-time updates
    const ws = diskAPI.connectWebSocket();
    diskAPI.onWSMessage('pathUpdated', (data) => {
      if (data.path === actualPath) {
        loadData(false);
      }
    });
    
    return () => {
      ws.close();
    };
  }, [actualPath, loadData]);
  
  const handleRefresh = () => {
    loadData(true);
  };
  
  const handleDelete = async (itemPath: string) => {
    if (window.confirm(`Are you sure you want to delete ${itemPath}?`)) {
      try {
        setIsLoading(true);
        const result = await diskAPI.deletePath(itemPath);
        
        if (result.success) {
          // Refresh data after successful deletion
          loadData(true);
        } else {
          // Show error message from server
          setError(result.message || 'Failed to delete item. Check permissions and try again.');
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Error deleting item:', err);
        setError('Failed to delete item. Check permissions and try again.');
        setIsLoading(false);
      }
    }
  };
  
  const navigateToPath = (node: FileNode) => {
    if (node.type === 'directory') {
      let newPath;
      
      if (isWindows) {
        // Windows path handling
        if (actualPath === 'root') {
          newPath = node.name;
        } else if (actualPath.endsWith(':')) {
          newPath = `${actualPath}\\${node.name}`;
        } else {
          newPath = `${actualPath}\\${node.name}`;
        }
        // Replace backslashes with forward slashes for URLs
        newPath = encodeURIComponent(newPath.replace(/\\/g, '/'));
      } else {
        // Unix path handling
        if (actualPath === 'root') {
          newPath = encodeURIComponent(node.name);
        } else if (actualPath === '/') {
          newPath = encodeURIComponent(`/${node.name}`);
        } else {
          newPath = encodeURIComponent(`${actualPath}/${node.name}`);
        }
      }
      
      navigate(`/analysis/${newPath}`);
    }
  };
  
  const navigateUp = () => {
    if (actualPath === 'root') return;
    
    let parentPath;
    
    if (isWindows) {
      // Windows path handling
      if (actualPath.endsWith(':\\')) {
        navigate('/analysis/root');
        return;
      }
      
      parentPath = actualPath.split('\\').slice(0, -1).join('\\');
      if (parentPath.endsWith(':')) {
        navigate(`/analysis/${parentPath}`);
      } else {
        navigate(`/analysis/${encodeURIComponent(parentPath.replace(/\\/g, '/'))}`);
      }
    } else {
      // Unix path handling
      if (actualPath === '/') {
        navigate('/analysis/root');
        return;
      }
      
      parentPath = actualPath.split('/').slice(0, -1).join('/');
      if (parentPath === '') {
        navigate(`/analysis/root`);
      } else {
        navigate(`/analysis/${encodeURIComponent(parentPath)}`);
      }
    }
  };
  
  const getItemPath = (itemName: string): string => {
    if (isWindows) {
      if (actualPath.endsWith(':')) {
        return `${actualPath}\\${itemName}`;
      } else {
        return `${actualPath}\\${itemName}`;
      }
    } else {
      if (actualPath === '/') {
        return `/${itemName}`;
      } else {
        return `${actualPath}/${itemName}`;
      }
    }
  };
  
  const renderTreemap = () => {
    if (!data || !data.children || data.children.length === 0) {
      return <Text>No data to display</Text>;
    }
    
    return (
      <div>
        {data.children.map((node, index) => (
          <Paper key={index} p="md" mb="sm" withBorder>
            <Group position="apart">
              <div>
                <Text 
                  weight={600} 
                  style={{ cursor: node.type === 'directory' ? 'pointer' : 'default' }}
                  onClick={() => node.type === 'directory' && navigateToPath(node)}
                >
                  {node.name}
                </Text>
                <Text size="sm">{formatBytes(node.size)}</Text>
              </div>
              <Group>
                {node.type === 'directory' && (
                  <Button size="xs" leftIcon={<IconRefresh size={14} />} onClick={() => navigateToPath(node)}>
                    Explore
                  </Button>
                )}
                <Button 
                  size="xs" 
                  color="red" 
                  leftIcon={<IconTrash size={14} />}
                  onClick={() => handleDelete(getItemPath(node.name))}
                >
                  Delete
                </Button>
              </Group>
            </Group>
          </Paper>
        ))}
      </div>
    );
  };
  
  return (
    <Container>
      <Group mb="md" position="apart">
        <Group>
          <Button 
            variant="outline" 
            leftIcon={<IconArrowLeft size={16} />}
            onClick={navigateUp}
            disabled={actualPath === 'root'}
          >
            Back
          </Button>
          <Title order={2}>Disk Analysis</Title>
        </Group>
        <Button 
          leftIcon={<IconRefresh size={16} />} 
          onClick={handleRefresh}
          loading={isLoading}
        >
          Refresh
        </Button>
      </Group>
      
      <Paper p="md" mb="md" withBorder>
        <Group position="apart">
          <div>
            <Text size="sm">Current path:</Text>
            <Text weight={700}>{actualPath}</Text>
          </div>
          {lastUpdated && (
            <Text size="sm" color="dimmed">
              Last updated: {lastUpdated.toLocaleString()}
            </Text>
          )}
        </Group>
      </Paper>
      
      {isLoading ? (
        <Paper p="xl" withBorder>
          <Group position="center">
            <Loader />
            <Text>Analyzing disk usage...</Text>
          </Group>
        </Paper>
      ) : error ? (
        <Paper p="md" withBorder>
          <Text color="red">{error}</Text>
        </Paper>
      ) : (
        <>
          <Paper p="md" mb="md" withBorder>
            <Group position="apart">
              <div>
                <Text size="sm">Total size:</Text>
                <Text weight={700}>{data ? formatBytes(data.size) : '0 B'}</Text>
              </div>
              <div>
                <Text size="sm">Items:</Text>
                <Text weight={700}>{data?.children?.length || 0}</Text>
              </div>
            </Group>
          </Paper>
          
          {renderTreemap()}
        </>
      )}
    </Container>
  );
} 