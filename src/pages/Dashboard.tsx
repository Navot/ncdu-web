import { Container, Title, Grid, Paper, Text, Group, RingProgress, Stack, Loader, Progress } from '@mantine/core';
import { IconDeviceFloppy, IconFolder, IconAlertTriangle } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { diskAPI, MountPoint } from '../api/disk';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function calculateUsagePercentage(used: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((used / total) * 100);
}

function UsageCard({ mountPoint, isAnalyzing }: { mountPoint: MountPoint, isAnalyzing?: boolean }) {
  const usagePercentage = calculateUsagePercentage(mountPoint.used, mountPoint.total);
  const isWarning = usagePercentage > 85;

  return (
    <Paper p="md" radius="md" withBorder style={isAnalyzing ? { borderColor: 'blue', borderWidth: 2 } : undefined}>
      <Group position="apart" mb="xs">
        <Group>
          <IconDeviceFloppy size={24} color={isAnalyzing ? 'blue' : undefined} />
          <div>
            <Text weight={500}>{mountPoint.name} {isAnalyzing && <Text span color="blue" size="xs">(Analyzing...)</Text>}</Text>
            <Text size="xs" color="dimmed">{mountPoint.path}</Text>
          </div>
        </Group>
      </Group>

      <Group position="apart" align="flex-end" spacing="xs">
        <Stack spacing={0}>
          <Text size="sm">Used: {formatBytes(mountPoint.used)}</Text>
          <Text size="sm">Total: {formatBytes(mountPoint.total)}</Text>
          <Text size="sm">Free: {formatBytes(mountPoint.available)}</Text>
        </Stack>
        <RingProgress
          size={80}
          roundCaps
          thickness={8}
          sections={[
            { value: usagePercentage, color: isWarning ? 'red' : 'blue' }
          ]}
          label={
            <Text color="blue" weight={700} align="center" size="xs">
              {usagePercentage}%
            </Text>
          }
        />
      </Group>
    </Paper>
  );
}

interface LargestDirectory {
  path: string;
  size: number;
  analyzed: boolean;
}

export default function Dashboard() {
  const [mountPoints, setMountPoints] = useState<MountPoint[]>([]);
  const [mountsLoading, setMountsLoading] = useState(true);
  const [mountsError, setMountsError] = useState<string | null>(null);
  const [largestDirs, setLargestDirs] = useState<LargestDirectory[]>([]);
  const [analyzedDrives, setAnalyzedDrives] = useState<Set<string>>(new Set());
  const [currentlyAnalyzing, setCurrentlyAnalyzing] = useState<string | null>(null);

  // Load mount points
  useEffect(() => {
    async function loadMounts() {
      try {
        setMountsLoading(true);
        const mounts = await diskAPI.getMounts();
        setMountPoints(mounts);
        setMountsError(null);
      } catch (err) {
        setMountsError('Failed to load disk information');
        console.error(err);
      } finally {
        setMountsLoading(false);
      }
    }

    loadMounts();
  }, []);

  // Analyze directories progressively
  useEffect(() => {
    async function analyzeDrive(mount: MountPoint) {
      if (analyzedDrives.has(mount.path)) return;
      
      setCurrentlyAnalyzing(mount.path);
      try {
        const result = await diskAPI.analyzePath(mount.path);
        if (result.children) {
          const dirs = result.children
            .filter(child => child.type === 'directory')
            .map(dir => ({
              path: `${mount.path}\\${dir.name}`,
              size: dir.size,
              analyzed: true
            }))
            .sort((a, b) => b.size - a.size)
            .slice(0, 5);
          
          setLargestDirs(prev => [...prev, ...dirs]);
        }
        setAnalyzedDrives(prev => new Set([...prev, mount.path]));
      } catch (err) {
        console.error(`Error analyzing ${mount.path}:`, err);
        // Add empty result to prevent retrying failed drives
        setAnalyzedDrives(prev => new Set([...prev, mount.path]));
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

  return (
    <Container size="xl">
      <Title order={2} mb="md">Storage Overview</Title>
      
      {mountsLoading ? (
        <Paper p="xl" radius="md" withBorder>
          <Group position="center">
            <Loader size="md" />
            <Text>Loading storage information...</Text>
          </Group>
        </Paper>
      ) : mountsError ? (
        <Paper p="md" radius="md" withBorder>
          <Group>
            <IconAlertTriangle color="red" size={24} />
            <Text color="red">{mountsError}</Text>
          </Group>
        </Paper>
      ) : (
        <Grid>
          {mountPoints.map((mountPoint) => (
            <Grid.Col key={mountPoint.path} xs={12} sm={6} lg={4}>
              <UsageCard 
                mountPoint={mountPoint} 
                isAnalyzing={currentlyAnalyzing === mountPoint.path}
              />
            </Grid.Col>
          ))}
        </Grid>
      )}

      <Title order={2} mt="xl" mb="md">Recent Activity</Title>
      <Paper p="md" radius="md" withBorder>
        <Group>
          <IconFolder size={24} />
          <div style={{ flex: 1 }}>
            <Text>Largest directories</Text>
            {mountPoints.length > 0 && (
              <div>
                <Group position="apart" mb="xs">
                  <Text size="sm" color="dimmed">
                    {analyzedDrives.size === 0 
                      ? "Starting analysis..." 
                      : `Analyzed ${analyzedDrives.size} of ${mountPoints.length} drives`}
                  </Text>
                  <Text size="sm" color="dimmed">
                    {currentlyAnalyzing && `Scanning ${currentlyAnalyzing}`}
                  </Text>
                </Group>
                <Progress 
                  value={(analyzedDrives.size / mountPoints.length) * 100} 
                  animate={!!currentlyAnalyzing}
                  mb="md"
                />
              </div>
            )}
            {largestDirs.length > 0 ? (
              <Stack spacing="xs">
                {largestDirs
                  .sort((a, b) => b.size - a.size)
                  .slice(0, 5)
                  .map((dir) => (
                    <Group key={dir.path} position="apart">
                      <Text size="sm">{dir.path}</Text>
                      <Text size="sm" color="dimmed">{formatBytes(dir.size)}</Text>
                    </Group>
                  ))
                }
              </Stack>
            ) : analyzedDrives.size === mountPoints.length ? (
              <Text size="sm" color="dimmed">No directories found</Text>
            ) : null}
          </div>
        </Group>
      </Paper>
    </Container>
  );
} 