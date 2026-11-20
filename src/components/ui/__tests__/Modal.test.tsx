import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from '../Modal';

describe('Modal', () => {
  it('renders dialog with title when open and nothing when closed', () => {
    const { rerender } = render(
      <Modal isOpen={false} onClose={vi.fn()} title="สร้างงานใหม่">
        <div>เนื้อหา</div>
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    rerender(
      <Modal isOpen={true} onClose={vi.fn()} title="สร้างงานใหม่">
        <div>เนื้อหา</div>
      </Modal>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('สร้างงานใหม่')).toBeInTheDocument();
    expect(screen.getByText('เนื้อหา')).toBeInTheDocument();
  });

  it('closes on Escape key, close button, and backdrop click, but not inside panel click', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose} title="ทดสอบ Modal">
        <button type="button">ปุ่มด้านใน</button>
      </Modal>,
    );

    fireEvent.click(screen.getByText('ปุ่มด้านใน'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /ปิดหน้าต่าง/i }));
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByTestId('modal-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
