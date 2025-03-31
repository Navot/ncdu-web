import { Container, Title, Paper, Switch, Stack, Text, TextInput, NumberInput, Button, Group, Loader, Alert } from '@mantine/core';
import { useEffect, useState } from 'react';
import { diskAPI, Settings } from '../api/disk';

const defaultSettings: Settings = {
  autoRefresh: true,
  refreshInterval: 5,
  excludePaths: ['/tmp', '/proc', '/sys'],
  showHiddenFiles: false,
  darkMode: false,
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      setIsLoading(true);
      setError(null);
      
      try {
        const data = await diskAPI.getSettings();
        setSettings(data);
      } catch (err) {
        console.error('Error loading settings:', err);
        setError('Failed to load settings. Using defaults.');
        setSettings(defaultSettings);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadSettings();
  }, []);
  
  const handleSave = async () => {
    setSaveLoading(true);
    setSaveError(null);
    setSaved(false);
    
    try {
      await diskAPI.updateSettings(settings);
      setSaved(true);
    } catch (err) {
      console.error('Error saving settings:', err);
      setSaveError('Failed to save settings.');
    } finally {
      setSaveLoading(false);
    }
  };
  
  const handleExcludePathsChange = (value: string) => {
    // Convert comma-separated string to array
    const paths = value.split(',').map(path => path.trim()).filter(Boolean);
    setSettings({
      ...settings,
      excludePaths: paths
    });
  };
  
  if (isLoading) {
    return (
      <Container size="sm">
        <Group position="center" style={{ minHeight: '200px' }}>
          <Loader size="lg" />
        </Group>
      </Container>
    );
  }
  
  if (error) {
    return (
      <Container size="sm">
        <Paper p="md" withBorder>
          <Alert color="red" title="Error" mb="md">
            {error}
          </Alert>
          <SettingsForm 
            settings={settings}
            setSettings={setSettings}
            handleSave={handleSave}
            saveLoading={saveLoading}
            saveError={saveError}
            saved={saved}
            handleExcludePathsChange={handleExcludePathsChange}
          />
        </Paper>
      </Container>
    );
  }
  
  return (
    <Container size="sm">
      <Title order={1} mb="md">Settings</Title>
      <Paper p="md" withBorder>
        <SettingsForm 
          settings={settings}
          setSettings={setSettings}
          handleSave={handleSave}
          saveLoading={saveLoading}
          saveError={saveError}
          saved={saved}
          handleExcludePathsChange={handleExcludePathsChange}
        />
      </Paper>
    </Container>
  );
}

interface SettingsFormProps {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  handleSave: () => Promise<void>;
  saveLoading: boolean;
  saveError: string | null;
  saved: boolean;
  handleExcludePathsChange: (value: string) => void;
}

function SettingsForm({ 
  settings, 
  setSettings, 
  handleSave, 
  saveLoading, 
  saveError, 
  saved,
  handleExcludePathsChange
}: SettingsFormProps) {
  return (
    <Stack spacing="md">
      <Switch
        label="Auto-refresh"
        checked={settings.autoRefresh}
        onChange={(event) => setSettings({
          ...settings,
          autoRefresh: event.currentTarget.checked
        })}
      />
      
      <NumberInput
        label="Refresh interval (minutes)"
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
        label="Exclude paths (comma-separated)"
        placeholder="/tmp,/proc,/sys"
        value={settings.excludePaths.join(',')}
        onChange={(event) => handleExcludePathsChange(event.currentTarget.value)}
      />
      
      <Switch
        label="Show hidden files"
        checked={settings.showHiddenFiles}
        onChange={(event) => setSettings({
          ...settings,
          showHiddenFiles: event.currentTarget.checked
        })}
      />
      
      <Switch
        label="Dark mode"
        checked={settings.darkMode}
        onChange={(event) => setSettings({
          ...settings,
          darkMode: event.currentTarget.checked
        })}
      />
      
      <Group position="apart">
        <Button onClick={handleSave} loading={saveLoading}>
          Save Settings
        </Button>
        
        {saved && <Alert color="green" sx={{ display: 'inline-block' }}>Settings saved!</Alert>}
        {saveError && <Alert color="red" sx={{ display: 'inline-block' }}>{saveError}</Alert>}
      </Group>
    </Stack>
  );
} 