import { MantineProvider } from '@mantine/core';
import type { Meta, StoryObj } from '@storybook/react';
import { theme } from '../../theme';
import { ConfirmDialog } from './ConfirmDialog';

const meta: Meta<typeof ConfirmDialog> = {
  title: 'ConfirmDialog',
  component: ConfirmDialog,
  decorators: [
    (Story) => (
      <MantineProvider theme={theme}>
        <Story />
      </MantineProvider>
    ),
  ],
  args: {
    opened: true,
    title: 'Remove download',
    description: 'Are you sure you want to remove this item? This action cannot be undone.',
    confirmLabel: 'Remove',
    cancelLabel: 'Cancel',
  },
  argTypes: {
    onClose: { action: 'closed' },
    onConfirm: { action: 'confirmed' },
  },
};

export default meta;

type Story = StoryObj<typeof ConfirmDialog>;

export const Default: Story = {};

export const Loading: Story = {
  args: {
    loading: true,
  },
};

export const WithCheckbox: Story = {
  args: {
    checkboxLabel: 'Also delete the file from this device',
    checkboxChecked: false,
  },
};
