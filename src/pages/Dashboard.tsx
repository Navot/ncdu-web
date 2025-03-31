import { Container, Title, Grid, Paper, Text, Group, RingProgress, Stack, Loader } from '@mantine/core';
import { IconDeviceFloppy, IconFolder, IconAlertTriangle } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { diskAPI, MountPoint } from '../api/disk';

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

function UsageCard({ mountPoint }: { mountPoint: MountPoint }) {
  const usagePercentage = (mountPoint.used / mountPoint.total) * 100;
  const color = usagePercentage > 80 ? 'red' : usagePercentage > 60 ? 'yellow' : 'blue';

  return (
    <Paper p="md" radius="md" withBorder>
      <Group position="apart" mb="xs">
        <Group>
          <IconDeviceFloppy size={24} />
          <div>
            <Text weight={500}>{mountPoint.name}</Text>
            <Text size="xs" color="dimmed">{mountPoint.path}</Text>
          </div>
        </Group>
        {mountPoint.alert && (
          <IconAlertTriangle size={20} color="orange" />
        )}
      </Group>

      <Group position="apart" mt="md">
        <RingProgress
          size={80}
          roundCaps
          thickness={8}
          sections={[{ value: usagePercentage, color }]}
          label={
            <Text size="xs" align="center">
              {Math.round(usagePercentage)}%
            </Text>
          }
        />
        <Stack spacing={0}>
          <Text size="sm">
            Used: {formatBytes(mountPoint.used)}
          </Text>
          <Text size="sm">
            Total: {formatBytes(mountPoint.total)}
          </Text>
          <Text size="sm">
            Free: {formatBytes(mountPoint.total - mountPoint.used)}
          </Text>
        </Stack>
      </Group>
    </Paper>
  );
}

export default function Dashboard() {
  const [mountPoints, setMountPoints] = useState<MountPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMountPoints() {
      try {
        const mounts = await diskAPI.getMounts();
        setMountPoints(mounts);
        setError(null);
      } catch (err) {
        setError('Failed to load mount points');
        console.error('Error loading mount points:', err);
      } finally {
        setLoading(false);
      }
    }

    loadMountPoints();

    // Set up WebSocket connection for real-time updates
    diskAPI.connectWebSocket((data) => {
      if (data.type === 'mountsUpdate') {
        setMountPoints(data.mounts);
      }
    });
  }, []);

  if (loading) {
    return (
      <Container size="xl">
        <Group position="center" style={{ minHeight: '200px' }}>
          <Loader size="lg" />
        </Group>
      </Container>
    );
  }

  if (error) {
    return (
      <Container size="xl">
        <Paper p="md" radius="md" withBorder>
          <Text color="red" align="center">{error}</Text>
        </Paper>
      </Container>
    );
  }

  return (
    <Container size="xl">
      <Title order={2} mb="md">Storage Overview</Title>
      
      <Grid>
        {mountPoints.map((mountPoint) => (
          <Grid.Col key={mountPoint.path} xs={12} sm={6} lg={4}>
            <UsageCard mountPoint={mountPoint} />
          </Grid.Col>
        ))}
      </Grid>

      <Title order={2} mt="xl" mb="md">Recent Activity</Title>
      <Paper p="md" radius="md" withBorder>
        <Group>
          <IconFolder size={24} />
          <div>
            <Text>Largest directories</Text>
            <Text size="sm" color="dimmed">Loading...</Text>
          </div>
        </Group>
      </Paper>
    </Container>
  );
} 