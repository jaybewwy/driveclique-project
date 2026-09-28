// 12:00 AM – 11:30 PM (full 24 hours) in 30-minute steps. Shared by the
// scheduler's time picker and EditDriveModal's time select, so both offer
// exactly the times the backend's parseTimeOfDay accepts.
function generateTimeSlots() {
  const slots = [];
  for (let h = 0; h <= 23; h++) {
    for (let m = 0; m < 60; m += 30) {
      const pad = (n) => n.toString().padStart(2, "0");
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 || 12;
      slots.push({
        time24: `${pad(h)}:${pad(m)}`,
        time12: `${h12}:${pad(m)} ${ampm}`,
      });
    }
  }
  return slots;
}

export const TIME_SLOTS = generateTimeSlots();
