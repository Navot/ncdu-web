import { useEffect, useRef, useState } from 'react';
import { Container, Title, Paper, Group, Text, ActionIcon, Stack, Breadcrumbs, Anchor, Loader } from '@mantine/core';
import { IconArrowUp, IconTrash, IconRefresh } from '@tabler/icons-react';
import * as d3 from 'd3';
import { useParams, useNavigate } from 'react-router-dom';
import { diskAPI, FileNode } from '../api/disk';

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

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

export default function Analysis() {
  const { path } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<FileNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const breadcrumbs = path ? path.split('/') : [];

  const currentPath = path || 'C:';

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const analysis = await diskAPI.analyzePath(currentPath);
        setData(analysis);
        setError(null);
      } catch (err) {
        setError('Failed to analyze path');
        console.error('Error analyzing path:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();

    // Set up WebSocket connection for real-time updates
    diskAPI.connectWebSocket((wsData) => {
      if (wsData.type === 'analysis' && wsData.data.name === currentPath) {
        setData(wsData.data);
      }
    });
  }, [currentPath]);

  const handleRefresh = () => {
    diskAPI.sendWSMessage('refresh', { path: currentPath });
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete ${currentPath}?`)) {
      diskAPI.sendWSMessage('delete', { path: currentPath });
    }
  };

  if (loading) {
    return (
      <Container size="xl">
        <Group position="center" style={{ minHeight: '200px' }}>
          <Loader size="lg" />
        </Group>
      </Container>
    );
  }

  if (error || !data) {
    return (
      <Container size="xl">
        <Paper p="md" radius="md" withBorder>
          <Text color="red" align="center">{error || 'No data available'}</Text>
        </Paper>
      </Container>
    );
  }

  return (
    <Container size="xl">
      <Group position="apart" mb="md">
        <Stack spacing="xs">
          <Title order={2}>Disk Analysis</Title>
          <Breadcrumbs>
            <Anchor onClick={() => navigate('/analysis')}>root</Anchor>
            {breadcrumbs.map((crumb, index) => (
              <Anchor
                key={index}
                onClick={() => navigate(`/analysis/${breadcrumbs.slice(0, index + 1).join('/')}`)}
              >
                {crumb}
              </Anchor>
            ))}
          </Breadcrumbs>
        </Stack>
        <Group>
          <ActionIcon variant="light" size="lg" onClick={handleRefresh}>
            <IconRefresh size={20} />
          </ActionIcon>
          <ActionIcon variant="light" size="lg" color="red" onClick={handleDelete}>
            <IconTrash size={20} />
          </ActionIcon>
          <ActionIcon
            variant="light"
            size="lg"
            onClick={() => navigate('/analysis')}
          >
            <IconArrowUp size={20} />
          </ActionIcon>
        </Group>
      </Group>

      <Paper p="md" radius="md" withBorder>
        <Treemap data={data} />
      </Paper>

      <Paper mt="md" p="md" radius="md" withBorder>
        <Title order={3} mb="sm">Details</Title>
        <Text size="sm" color="dimmed">
          Total Size: {formatBytes(data.size)}
        </Text>
      </Paper>
    </Container>
  );
} 