import { Container, Title, Paper, Switch, Stack, Text, TextInput, NumberInput, Button, Group, Loader } from '@mantine/core';
import { useEffect, useState } from 'react';
import { diskAPI, Settings as SettingsType } from '../api/disk';

const defaultSettings: SettingsType = {
  autoRefresh: true,
  refreshInterval: 5,
  excludePaths: '/tmp,/proc,/sys',
  showHiddenFiles: false,
  darkMode: false,
};

export default function Settings() {
  const [settings, setSettings] = useState<SettingsType>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const savedSettings = await diskAPI.getSettings();
        setSettings(savedSettings);
        setError(null);
      } catch (err) {
        setError('Failed to load settings');
        console.error('Error loading settings:', err);
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      await diskAPI.updateSettings(settings);
      setError(null);
    } catch (err) {
      setError('Failed to save settings');
      console.error('Error saving settings:', err);
    } finally {
      setSaving(false);
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

  return (
    <Container size="xl">
      <Title order={2} mb="md">Settings</Title>

      {error && (
        <Paper p="md" radius="md" withBorder mb="md">
          <Text color="red">{error}</Text>
        </Paper>
      )}

      <Paper p="md" radius="md" withBorder>
        <Stack spacing="md">
          <Title order={3}>Display</Title>
          
          <Switch
            label="Show Hidden Files"
            checked={settings.showHiddenFiles}
            onChange={(event) => setSettings({
              ...settings,
              showHiddenFiles: event.currentTarget.checked
            })}
          />

          <Switch
            label="Dark Mode"
            checked={settings.darkMode}
            onChange={(event) => setSettings({
              ...settings,
              darkMode: event.currentTarget.checked
            })}
          />

          <Title order={3} mt="md">Scanning</Title>

          <Switch
            label="Auto Refresh"
            checked={settings.autoRefresh}
            onChange={(event) => setSettings({
              ...settings,
              autoRefresh: event.currentTarget.checked
            })}
          />

          <NumberInput
            label="Refresh Interval (minutes)"
            value={settings.refreshInterval}
            min={1}
            max={60}
            disabled={!settings.autoRefresh}
            onChange={(value) => setSettings({
              ...settings,
              refreshInterval: value || 5
            })}
          />

          <TextInput
            label="Exclude Paths"
            description="Comma-separated list of paths to exclude from scanning"
            value={settings.excludePaths}
            onChange={(event) => setSettings({
              ...settings,
              excludePaths: event.currentTarget.value
            })}
          />

          <Group position="right" mt="xl">
            <Button onClick={handleSave} loading={saving}>
              Save Settings
            </Button>
          </Group>
        </Stack>
      </Paper>

      <Paper mt="md" p="md" radius="md" withBorder>
        <Title order={3} mb="md">About</Title>
        <Text>
          ncdu Web v1.0.0
        </Text>
        <Text size="sm" color="dimmed" mt="xs">
          A modern web-based disk usage analyzer inspired by ncdu
        </Text>
      </Paper>
    </Container>
  );
} 