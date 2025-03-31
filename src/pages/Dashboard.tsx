import { Container, Title, Paper, Text, Group, Stack, Loader, Progress, Button, Badge, Alert, Center, SimpleGrid } from '@mantine/core';
import { useEffect, useState } from 'react';
import { diskAPI, MountPoint } from '../api/disk';

function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  if (!bytes || isNaN(bytes)) return 'Unknown';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  // Find the appropriate unit
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  
  // Format with the right number of decimal places
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Define the directory item interface
interface DirectoryItem {
  path: string;
  size: number;
  name: string;
}

export default function Dashboard() {
  const [mountPoints, setMountPoints] = useState<MountPoint[]>([]);
  const [largestDirs, setLargestDirs] = useState<Record<string, DirectoryItem[]>>({});
  const [analyzedDrives, setAnalyzedDrives] = useState<Set<string>>(new Set());
  const [currentlyAnalyzing, setCurrentlyAnalyzing] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number>(0);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [isLoading, setIsLoading] = useState<Set<string>>(new Set());
  const [error, setError] = useState<Set<string>>(new Set());
  const [scanInfo, setScanInfo] = useState<Record<string, { scanDate: Date; dirCount: number }>>({});

  // Load mount points (use cached data)
  useEffect(() => {
    async function loadMounts() {
      try {
        const { mountPoints: mounts, lastUpdated } = await diskAPI.getMounts();
        setMountPoints(mounts);
        setLastUpdated(lastUpdated);
      } catch (err) {
        console.error(err);
      }
    }

    loadMounts();
  }, []);

  // Analyze directories progressively (use cached data when available)
  useEffect(() => {
    async function analyzeDrive(mount: MountPoint) {
      if (analyzedDrives.has(mount.path)) return;
      
      setCurrentlyAnalyzing(mount.path);
      try {
        const { result, lastUpdated } = await diskAPI.analyzePath(mount.path);
        setLastUpdated(lastUpdated);
        
        if (result.children) {
          const dirs = result.children
            .filter(child => child.type === 'directory' && child.size > 0)
            .map(dir => ({
              path: `${mount.path}\\${dir.name}`,
              size: dir.size,
              name: dir.name
            }))
            .sort((a, b) => b.size - a.size)
            .slice(0, 10);
          
          setLargestDirs(prev => ({
            ...prev,
            [mount.path]: dirs
          }));
        }
        setAnalyzedDrives(prev => addToSet(prev, mount.path));
      } catch (err) {
        console.error(`Error analyzing ${mount.path}:`, err);
        // Add empty result to prevent retrying failed drives
        setAnalyzedDrives(prev => addToSet(prev, mount.path));
      } finally {
        setCurrentlyAnalyzing(null);
      }
    }

    // Analyze one drive at a time
    const unanalyzedMount = mountPoints.find(mount => !analyzedDrives.has(mount.path));
    if (unanalyzedMount && !currentlyAnalyzing) {
      analyzeDrive(unanalyzedMount);
    }
  }, [mountPoints, analyzedDrives, currentlyAnalyzing]);

  const refreshMount = async (mountPath: string) => {
    try {
      setCurrentlyAnalyzing(mountPath);
      setIsLoading(prev => addToSet(prev, mountPath));
      setError(prev => removeFromSet(prev, mountPath));
      
      // Force refresh the mount path
      const response = await diskAPI.analyzePath(mountPath, true);
      console.log(`Received analysis for ${mountPath}:`, response);
      
      // If the result doesn't have children or has an error, handle it
      if (!response.result.children || response.result.children.length === 0) {
        console.log(`No children found for ${mountPath}`);
        setError(prev => addToSet(prev, mountPath));
        setIsLoading(prev => removeFromSet(prev, mountPath));
        setCurrentlyAnalyzing(null);
        return;
      }
      
      // Log the number of children and their details
      console.log(`Received ${response.result.children.length} items for ${mountPath}`);
      response.result.children.forEach(child => {
        console.log(`- ${child.name}: ${formatBytes(child.size)} (${child.type})`);
      });
      
      // Filter out system files placeholder and zero-sized items
      const validDirs = response.result.children
        .filter(item => 
          item.type === 'directory' && 
          item.size > 0 && 
          !item.name.includes('(skipped)') &&
          !item.name.includes('No accessible'))
        .sort((a, b) => b.size - a.size);
        
      console.log(`Found ${validDirs.length} valid directories`);
      
      // Update the largestDirs state with the new data
      setLargestDirs(prev => ({
        ...prev,
        [mountPath]: validDirs.map(dir => ({
          path: `${mountPath}\\${dir.name}`,
          size: dir.size,
          name: dir.name
        }))
      }));
      
      // Update lastUpdated timestamp
      setLastUpdated(response.lastUpdated);
      
      // Update the scan info state
      setScanInfo(prev => ({
        ...prev,
        [mountPath]: {
          scanDate: new Date(response.lastUpdated),
          dirCount: validDirs.length
        }
      }));
      
    } catch (error) {
      console.error(`Error refreshing ${mountPath}:`, error);
      setError(prev => addToSet(prev, mountPath));
    } finally {
      setIsLoading(prev => removeFromSet(prev, mountPath));
      setCurrentlyAnalyzing(null);
    }
  };

  const refreshAll = async () => {
    if (refreshingAll) return;
    
    try {
      setRefreshingAll(true);
      
      for (let i = 0; i < mountPoints.length; i++) {
        const mount = mountPoints[i];
        setCurrentlyAnalyzing(mount.path);
        setAnalysisProgress(Math.round((i / mountPoints.length) * 100));
        
        try {
          await refreshMount(mount.path);
        } catch (error) {
          console.error(`Error refreshing ${mount.path}:`, error);
          // Continue with next mount even if this one fails
        }
      }
      
      setAnalysisProgress(100);
    } finally {
      setRefreshingAll(false);
      setCurrentlyAnalyzing(null);
    }
  };

  const formatDriveInfo = (mount: MountPoint) => {
    const total = formatBytes(mount.total);
    const available = formatBytes(mount.available);
    return `${total} - ${available} available`;
  };

  return (
    <Container size="xl">
      <Title order={1} mb="md">Storage Overview</Title>
      
      {/* Add a progress bar when analyzing */}
      {currentlyAnalyzing && (
        <Paper p="md" mb="md" withBorder>
          <Group position="apart" mb="xs">
            <Text weight={500}>
              Analyzing: {currentlyAnalyzing}
            </Text>
            <Badge color="blue">
              {refreshingAll ? `${analysisProgress}%` : 'Scanning'}
            </Badge>
          </Group>
          <Progress
            value={refreshingAll ? analysisProgress : undefined}
            animate={!refreshingAll}
            size="sm"
          />
          <Text size="sm" color="dimmed" mt="xs">
            This might take a while for large drives...
          </Text>
        </Paper>
      )}
      
      <Group position="apart" mb="md">
        <Text>
          Last updated: {lastUpdated ? new Date(lastUpdated).toLocaleString() : 'Never'}
        </Text>
        <Button
          onClick={refreshAll}
          loading={refreshingAll}
          disabled={isLoading.size > 0 && !refreshingAll}
        >
          Refresh All
        </Button>
      </Group>
      
      <SimpleGrid cols={2} breakpoints={[{ maxWidth: 'sm', cols: 1 }]}>
        {mountPoints.map(mount => (
          <Paper key={mount.path} p="md" withBorder>
            <Group position="apart">
              <div>
                <Text weight={700}>{mount.path}</Text>
                <Text size="sm" color="dimmed">
                  {formatDriveInfo(mount)}
                  {scanInfo[mount.path] && ` - ${scanInfo[mount.path].dirCount} directories`}
                </Text>
              </div>
              <Button
                variant="light"
                onClick={() => refreshMount(mount.path)}
                loading={isLoading.has(mount.path)}
                disabled={refreshingAll}
              >
                Refresh
              </Button>
            </Group>
            
            {isLoading.has(mount.path) ? (
              <Center p="xl">
                <Stack align="center">
                  <Loader />
                  <Text size="sm">Scanning drive...</Text>
                </Stack>
              </Center>
            ) : error.has(mount.path) ? (
              <Alert color="red" mt="md">
                Error scanning drive. Please try again.
              </Alert>
            ) : (
              <Stack mt="md" spacing="xs">
                <Text weight={500}>Largest Directories:</Text>
                {largestDirs[mount.path] && largestDirs[mount.path].length > 0 ? (
                  largestDirs[mount.path]
                    .slice(0, 10)
                    .map((dir, i) => (
                      <Paper key={i} p="xs" withBorder>
                        <Group position="apart">
                          <Text sx={{ wordBreak: 'break-all' }} size="sm">
                            {dir.name}
                          </Text>
                          <Text size="sm" weight={600}>{formatBytes(dir.size)}</Text>
                        </Group>
                      </Paper>
                    ))
                ) : (
                  <Text color="dimmed" size="sm">
                    {scanInfo[mount.path] ? 'No large directories found' : 'Click Refresh to scan'}
                  </Text>
                )}
              </Stack>
            )}
          </Paper>
        ))}
      </SimpleGrid>
    </Container>
  );
}

function addToSet(prev: Set<string>, newItem: string): Set<string> {
  const newSet = new Set(Array.from(prev));
  newSet.add(newItem);
  return newSet;
}

function removeFromSet(prev: Set<string>, item: string): Set<string> {
  const newSet = new Set(Array.from(prev));
  newSet.delete(item);
  return newSet;
} 