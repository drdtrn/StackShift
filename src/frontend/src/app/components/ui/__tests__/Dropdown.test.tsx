import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dropdown } from '../Dropdown';

const items = [
  { id: 'edit', label: 'Edit' },
  { id: 'delete', label: 'Delete' },
  { id: 'archive', label: 'Archive', disabled: true },
];

describe('Dropdown', () => {
  it('renders the trigger element', () => {
    render(
      <Dropdown trigger={<button>Actions</button>} items={items} onSelect={jest.fn()} />,
    );
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('menu is not visible on initial render', () => {
    render(
      <Dropdown trigger={<button>Actions</button>} items={items} onSelect={jest.fn()} />,
    );
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens the menu when trigger is clicked', async () => {
    render(
      <Dropdown trigger={<button>Actions</button>} items={items} onSelect={jest.fn()} />,
    );
    await userEvent.click(screen.getByText('Actions'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('renders all items inside the menu', async () => {
    render(
      <Dropdown trigger={<button>Actions</button>} items={items} onSelect={jest.fn()} />,
    );
    await userEvent.click(screen.getByText('Actions'));
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
  });

  it('calls onSelect with the correct id when an item is clicked', async () => {
    const onSelect = jest.fn();
    render(
      <Dropdown trigger={<button>Actions</button>} items={items} onSelect={onSelect} />,
    );
    await userEvent.click(screen.getByText('Actions'));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    expect(onSelect).toHaveBeenCalledWith('edit');
  });

  it('closes the menu after selecting an item', async () => {
    render(
      <Dropdown trigger={<button>Actions</button>} items={items} onSelect={jest.fn()} />,
    );
    await userEvent.click(screen.getByText('Actions'));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('disabled items cannot be selected', async () => {
    const onSelect = jest.fn();
    render(
      <Dropdown trigger={<button>Actions</button>} items={items} onSelect={onSelect} />,
    );
    await userEvent.click(screen.getByText('Actions'));
    const archiveItem = screen.getByRole('menuitem', { name: 'Archive' });
    expect(archiveItem).toBeDisabled();
  });

  it('closes on Escape key press', async () => {
    render(
      <Dropdown trigger={<button>Actions</button>} items={items} onSelect={jest.fn()} />,
    );
    await userEvent.click(screen.getByText('Actions'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
