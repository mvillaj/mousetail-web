import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Confidence, Field, Modal, ModalHeaderSlot, RatingInput, Stars, Working } from './ui';

describe('Field', () => {
  it('ties the label to its input', () => {
    render(
      <Field label="Coffee name" hint="As printed on the bag.">
        <input />
      </Field>,
    );
    const input = screen.getByLabelText('Coffee name');
    expect(input.tagName).toBe('INPUT');
    expect(input).toHaveAccessibleDescription('As printed on the bag.');
  });

  it('keeps an id the input already has', () => {
    render(
      <Field label="Roaster">
        <input id="roaster" />
      </Field>,
    );
    expect(screen.getByLabelText('Roaster')).toHaveAttribute('id', 'roaster');
  });

  it('names a composite child as a group', () => {
    render(
      <Field label="Rating">
        <div>
          <button type="button">1 star</button>
        </div>
      </Field>,
    );
    expect(screen.getByRole('group', { name: 'Rating' })).toBeInTheDocument();
  });
});

describe('Stars', () => {
  it('labels the rating for screen readers', () => {
    render(<Stars value={4} />);
    expect(screen.getByRole('img', { name: '4 of 5 stars' })).toBeInTheDocument();
  });

  it('says unrated when there is no value', () => {
    render(<Stars value={null} />);
    expect(screen.getByText('unrated')).toBeInTheDocument();
  });
});

describe('RatingInput', () => {
  it('reports the clicked star', async () => {
    const onChange = vi.fn();
    render(<RatingInput value={null} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: '3 stars' }));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('clears the rating when the current star is clicked again', async () => {
    const onChange = vi.fn();
    render(<RatingInput value={3} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: '3 stars' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('marks stars up to the value as pressed', () => {
    render(<RatingInput value={2} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: '2 stars' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '3 stars' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  describe('the burst', () => {
    function Rating({ start = null }: { start?: number | null }) {
      const [value, setValue] = useState<number | null>(start);
      return <RatingInput value={value} onChange={setValue} />;
    }
    const sparksOn = (n: number) =>
      screen.getByRole('button', { name: `${n} stars` }).querySelectorAll('.rating-spark');

    it('throws sparks from the star that raised the rating', async () => {
      const { container } = render(<Rating />);
      expect(container.querySelectorAll('.rating-spark')).toHaveLength(0);
      await userEvent.click(screen.getByRole('button', { name: '4 stars' }));
      expect(sparksOn(4).length).toBeGreaterThan(0);
      expect(container.querySelectorAll('.rating-spark')).toHaveLength(sparksOn(4).length);
    });

    it('stays quiet when the rating goes down or is cleared', async () => {
      const { container } = render(<Rating start={4} />);
      await userEvent.click(screen.getByRole('button', { name: '2 stars' }));
      expect(container.querySelectorAll('.rating-spark')).toHaveLength(0);
      await userEvent.click(screen.getByRole('button', { name: '2 stars' }));
      expect(container.querySelectorAll('.rating-spark')).toHaveLength(0);
    });

    it('does not celebrate a rating that was already there', () => {
      const { container } = render(<Rating start={5} />);
      expect(container.querySelectorAll('.rating-spark')).toHaveLength(0);
    });
  });
});

describe('Modal', () => {
  it('closes on Escape and on the close button', async () => {
    const onClose = vi.fn();
    render(
      <Modal title="Edit shot" onClose={onClose}>
        body
      </Modal>,
    );
    expect(screen.getByRole('dialog', { name: 'Edit shot' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('does not close when clicking inside the dialog', async () => {
    const onClose = vi.fn();
    render(
      <Modal title="Edit shot" onClose={onClose}>
        body
      </Modal>,
    );
    await userEvent.click(screen.getByText('body'));
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('ModalHeaderSlot', () => {
  it('puts its content in the modal header, beside the close button', () => {
    render(
      <Modal title="Log" onClose={() => {}}>
        <ModalHeaderSlot>
          <button>Mode</button>
        </ModalHeaderSlot>
        <p>body</p>
      </Modal>,
    );
    const header = screen.getByRole('heading', { name: 'Log' }).parentElement!;
    expect(header).toContainElement(screen.getByRole('button', { name: 'Mode' }));
    expect(header).not.toContainElement(screen.getByText('body'));
  });

  it('renders in place when there is no modal', () => {
    render(
      <ModalHeaderSlot>
        <button>Mode</button>
      </ModalHeaderSlot>,
    );
    expect(screen.getByRole('button', { name: 'Mode' })).toBeInTheDocument();
  });
});

describe('Confidence', () => {
  it('pairs each level with its words and an icon', () => {
    const { container, rerender } = render(<Confidence level="high" />);
    expect(screen.getByText('Confident')).toBeInTheDocument();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    rerender(<Confidence level="low" />);
    expect(screen.getByText('A guess until you taste it')).toBeInTheDocument();
  });
});

describe('Working', () => {
  it('only shows the clock once the wait is worth mentioning', () => {
    const { rerender } = render(<Working label="Thinking" seconds={3} />);
    expect(screen.queryByText('3s')).not.toBeInTheDocument();
    rerender(<Working label="Thinking" seconds={4} />);
    expect(screen.getByText('4s')).toBeInTheDocument();
  });
});
