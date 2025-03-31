import { MantineProvider } from '@mantine/core';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState } from 'react';
import '@mantine/core/styles.css';

// Import layouts
import MainLayout from './layouts/MainLayout';

// Import pages
import Dashboard from './pages/Dashboard';
import Analysis from './pages/Analysis';
import Settings from './pages/Settings';

export default function App() {
  const [opened, setOpened] = useState(false);

  return (
    <MantineProvider>
      <BrowserRouter>
        <MainLayout opened={opened} setOpened={setOpened}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/analysis" element={<Analysis />} />
            <Route path="/analysis/:path" element={<Analysis />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </MainLayout>
      </BrowserRouter>
    </MantineProvider>
  );
} 