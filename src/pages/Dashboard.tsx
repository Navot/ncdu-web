import { Container, Title, Grid, Paper, Text, Button, Group, Progress, Box } from '@mantine/core';
import { useEffect, useState } from 'react';
import { IconRefresh } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { diskAPI, MountPoint } from '../api/disk';

// Detect platform for path handling
const isWindows = navigator.platform.toLowerCase().includes('win');
const PATH_SEPARATOR = isWindows ? '\\' : '/';

function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export default function Dashboard() {
  const [mounts, setMounts] = useState<MountPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [largestDirs, setLargestDirs] = useState<Record<string, {name: string, size: number, path: string}[]>>({});
  const [refreshProgress, setRefreshProgress] = useState(0);
  const [currentlyAnalyzing, setCurrentlyAnalyzing] = useState<string | null>(null);
  const navigate = useNavigate();
  
  useEffect(() => {
    loadMounts();
    
    // Setup WebSocket connection for real-time updates
    const ws = diskAPI.connectWebSocket();
    
    diskAPI.onWSMessage('mountsUpdated', (data) => {
      setMounts(data.mounts);
    });
    
    diskAPI.onWSMessage('progressUpdate', (data) => {
      setRefreshProgress(data.progress);
      setCurrentlyAnalyzing(data.currentPath);
    });
    
    return () => {
      ws.close();
    };
  }, []);
  
  const loadMounts = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await diskAPI.getMounts();
      setMounts(response.mounts);
      
      // Load large directories for each mount
      response.mounts.forEach((mount) => {
        refreshMount(mount);
      });
    } catch (err) {
      console.error('Error loading mounts:', err);
      setError('Failed to load disk information. Please try again.');
      setIsLoading(false);
    }
  };
  
  const refreshAll = async () => {
    setRefreshProgress(0);
    setCurrentlyAnalyzing(null);
    setLargestDirs({});
    
    for (let i = 0; i < mounts.length; i++) {
      setRefreshProgress(Math.round((i / mounts.length) * 100));
      await refreshMount(mounts[i], true);
    }
    
    setRefreshProgress(100);
    setCurrentlyAnalyzing(null);
  };
  
  const refreshMount = async (mount: MountPoint, forceRefresh = false) => {
    try {
      setCurrentlyAnalyzing(mount.path);
      const response = await diskAPI.analyzePath(mount.path, forceRefresh);
      
      // Log data received for debugging
      console.log(`Received ${response.result?.children?.length || 0} children for ${mount.path}`);
      if (response.result?.children?.length > 0) {
        console.log(`First few items:`, response.result.children.slice(0, 3).map(c => ({
          name: c.name,
          size: c.size,
          type: c.type
        })));
      }
      
      if (response.result && response.result.children) {
        // Filter out empty items and sort directories by size
        const sortedDirs = response.result.children
          .filter(item => item.type === 'directory' && item.size > 0)
          .sort((a, b) => b.size - a.size)
          .slice(0, 10)
          .map(dir => ({
            name: dir.name,
            size: dir.size,
            path: mount.path === '/' || mount.path.endsWith(':') ? 
              `${mount.path}${dir.name}` : 
              `${mount.path}${PATH_SEPARATOR}${dir.name}`
          }));
        
        setLargestDirs(prev => ({
          ...prev,
          [mount.path]: sortedDirs
        }));
      }
    } catch (err) {
      console.error(`Error analyzing mount ${mount.path}:`, err);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleAnalyzePath = (path: string) => {
    // For URLs, we need to encode the path and replace backslashes with forward slashes
    const encodedPath = encodeURIComponent(path.replace(/\\/g, '/'));
    navigate(`/analysis/${encodedPath}`);
  };
  
  return (
    <Container>
      <Group position="apart" mb="md">
        <Title>Disk Usage Dashboard</Title>
        <Button 
          leftIcon={<IconRefresh size={16} />} 
          onClick={refreshAll}
          loading={refreshProgress > 0 && refreshProgress < 100}
        >
          Refresh All
        </Button>
      </Group>
      
      {refreshProgress > 0 && (
        <Paper p="md" mb="md" withBorder>
          <Text mb="xs">
            {refreshProgress < 100 
              ? `Scanning... (${currentlyAnalyzing || 'Analyzing disks'})`
              : 'Scan complete!'
            }
          </Text>
          <Progress value={refreshProgress} />
        </Paper>
      )}
      
      {error && (
        <Paper p="md" mb="md" withBorder>
          <Text color="red">{error}</Text>
        </Paper>
      )}
      
      <Grid>
        {mounts.map((mount) => (
          <Grid.Col key={mount.path} span={12} md={6}>
            <Paper p="md" withBorder>
              <Group position="apart" mb="md">
                <div>
                  <Text weight={700}>{mount.name || mount.path}</Text>
                  <Text size="sm">
                    {formatBytes(mount.used)} used of {formatBytes(mount.size)}
                  </Text>
                </div>
                <Button 
                  size="xs" 
                  variant="outline"
                  onClick={() => handleAnalyzePath(mount.path)}
                >
                  Analyze
                </Button>
              </Group>
              
              <Progress 
                value={(mount.used / mount.size) * 100} 
                color={mount.used / mount.size > 0.9 ? 'red' : mount.used / mount.size > 0.7 ? 'yellow' : 'blue'}
                mb="md"
              />
              
              <Text size="sm" weight={600} mb="xs">Largest Directories:</Text>
              
              {isLoading && !largestDirs[mount.path] ? (
                <Text size="sm" color="dimmed">Loading directory information...</Text>
              ) : largestDirs[mount.path] && largestDirs[mount.path].length > 0 ? (
                <Box>
                  {largestDirs[mount.path].map((dir, index) => (
                    <Paper key={index} p="xs" mb="xs" withBorder>
                      <Group position="apart">
                        <Text 
                          size="sm" 
                          style={{ 
                            cursor: 'pointer',
                            fontWeight: 500,
                            color: '#228be6'
                          }}
                          onClick={() => handleAnalyzePath(dir.path)}
                        >
                          {dir.name}
                        </Text>
                        <Text size="sm">{formatBytes(dir.size)}</Text>
                      </Group>
                    </Paper>
                  ))}
                </Box>
              ) : (
                <Text size="sm" color="dimmed">
                  {currentlyAnalyzing === mount.path 
                    ? 'Scanning directories...' 
                    : 'No directories found or none with significant size.'}
                </Text>
              )}
            </Paper>
          </Grid.Col>
        ))}
      </Grid>
    </Container>
  );
} 