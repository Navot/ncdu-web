import { AppShell, Navbar, Header, Title, UnstyledButton, Group, Text, Burger } from '@mantine/core';
import { IconHome, IconChartBar, IconSettings } from '@tabler/icons-react';
import { useNavigate, useLocation } from 'react-router-dom';

interface MainLayoutProps {
  children: React.ReactNode;
  opened: boolean;
  setOpened: (opened: boolean) => void;
}

interface NavLinkProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

function NavLink({ icon, label, active, onClick }: NavLinkProps) {
  return (
    <UnstyledButton
      onClick={onClick}
      sx={(theme) => ({
        display: 'block',
        width: '100%',
        padding: theme.spacing.xs,
        borderRadius: theme.radius.sm,
        color: active ? theme.colors.blue[7] : theme.colors.gray[7],
        backgroundColor: active ? theme.colors.blue[0] : 'transparent',
        '&:hover': {
          backgroundColor: theme.colors.gray[0],
        },
      })}
    >
      <Group>
        {icon}
        <Text size="sm">{label}</Text>
      </Group>
    </UnstyledButton>
  );
}

export default function MainLayout({ children, opened, setOpened }: MainLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const links = [
    { icon: <IconHome size={16} />, label: 'Dashboard', path: '/' },
    { icon: <IconChartBar size={16} />, label: 'Analysis', path: '/analysis' },
    { icon: <IconSettings size={16} />, label: 'Settings', path: '/settings' },
  ];

  return (
    <AppShell
      padding="md"
      header={
        <Header height={60} p="md">
          <Group>
            <Burger opened={opened} onClick={() => setOpened(!opened)} size="sm" />
            <Title order={3}>NCDU Web</Title>
          </Group>
        </Header>
      }
      navbar={
        <Navbar p="md" width={{ sm: 300 }} hiddenBreakpoint="sm" hidden={!opened}>
          <Navbar.Section grow mt="xs">
            {links.map((link) => (
              <NavLink
                key={link.path}
                icon={link.icon}
                label={link.label}
                active={location.pathname === link.path}
                onClick={() => navigate(link.path)}
              />
            ))}
          </Navbar.Section>
        </Navbar>
      }
    >
      {children}
    </AppShell>
  );
} 