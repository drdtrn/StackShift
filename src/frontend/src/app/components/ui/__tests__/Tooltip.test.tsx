import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tooltip } from '../Tooltip';

const renderTooltip = (placement?: 'top' | 'bottom' | 'left' | 'right') =>
  render(
    <Tooltip content="More info" placement={placement}>
      <button>Hover me</button>
    </Tooltip>,
  );

describe('Tooltip', () => {
  it('renders the trigger element', () => {
    renderTooltip();
    expect(screen.getByRole('button', { name: 'Hover me' })).toBeInTheDocument();
  });

  it('renders the tooltip element in the DOM (always mounted)', () => {
    renderTooltip();
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('tooltip content is present', () => {
    renderTooltip();
    expect(screen.getByRole('tooltip')).toHaveTextContent('More info');
  });

  it('links trigger to tooltip via aria-describedby', () => {
    renderTooltip();
    const trigger = screen.getByRole('button');
    const tooltip = screen.getByRole('tooltip');
    expect(trigger).toHaveAttribute('aria-describedby', tooltip.getAttribute('id'));
  });

  it('makes the tooltip visible on mouse enter', async () => {
    renderTooltip();
    const trigger = screen.getByRole('button');
    await userEvent.hover(trigger);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.className).toMatch(/opacity-100/);
  });

  it('hides the tooltip on mouse leave', async () => {
    renderTooltip();
    const trigger = screen.getByRole('button');
    await userEvent.hover(trigger);
    await userEvent.unhover(trigger);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.className).toMatch(/opacity-0/);
  });

  it('makes the tooltip visible on keyboard focus', async () => {
    renderTooltip();
    const trigger = screen.getByRole('button');
    await userEvent.tab(); // focus the button
    expect(trigger).toHaveFocus();
    expect(screen.getByRole('tooltip').className).toMatch(/opacity-100/);
  });

  it('hides the tooltip on blur', async () => {
    renderTooltip();
    const trigger = screen.getByRole('button');
    await act(async () => {
      trigger.focus();
      trigger.blur();
    });
    expect(screen.getByRole('tooltip').className).toMatch(/opacity-0/);
  });
});
