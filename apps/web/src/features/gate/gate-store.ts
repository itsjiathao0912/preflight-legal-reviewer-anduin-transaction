import { create } from 'zustand';

/** Gate popover open state, shared so the Counsel view's "See reasons" can open it. */
export const useGatePopover = create<{ open: boolean; setOpen: (o: boolean) => void }>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
