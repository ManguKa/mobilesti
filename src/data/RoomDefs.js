const ROOM_LABELS = {
  1: [
    'Lecture Hall A',
    'Seminar Room',
    'Lecture Hall B',
    'Study Area',
    'Design Lab',
    'Meeting Room',
    'Computer Lab',
    'Tutorial Room',
    'Media Studio',
    'Conference Room',
  ],
  2: [
    'Advanced Workshop',
    'Project Lab',
    'Discussion Room',
    'Training Room',
    'Research Suite',
    'Innovation Hub',
    'Collaboration Space',
    'Media Room',
    'Strategy Room',
    'Guest Lecture Room',
  ],
  3: [
    'Physics Lab',
    'Chemistry Lab',
    'Biology Lab',
    'Project Room',
    'Robotics Lab',
    'Engineering Lab',
    'Studio Space',
    'Simulation Lab',
    'Testing Lab',
    'Tech Lab',
  ],
};

const BUILDING_MAP = {
  1: 'CICT BUILDING',
  2: 'CICT BUILDING',
  3: 'CICT BUILDING',
};

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getRoomStatus(roomNumber) {
  const normalized = String(roomNumber);
  const score = hashString(normalized) % 100;
  if (score < 55) return 'available';
  if (score < 85) return 'occupied';
  return 'reserved';
}

export function normalizeRoomKey(value) {
  if (value == null) return '';
  let key = String(value).trim();
  if (key.startsWith('room-')) {
    key = key.slice(5);
  }
  return key;
}

export function getRoomKey(room) {
  if (!room) return '';
  return normalizeRoomKey(room.roomNumber || room.id);
}

export function getReservedRoomKeys(reservations) {
  const reserved = new Set();
  reservations.forEach((reservation) => {
    if (!reservation || !reservation.roomId) return;
    const key = normalizeRoomKey(reservation.roomId);
    if (!key) return;
    if (['pending', 'approved'].includes(reservation.status)) {
      reserved.add(key);
    }
  });
  return reserved;
}

export function getEffectiveRoomStatus(room, reservations = []) {
  const baseStatus = room?.status || 'available';
  if (baseStatus === 'occupied') return 'occupied';
  if (baseStatus === 'reserved') return 'reserved';

  const roomKey = getRoomKey(room);
  const reservedKeys = getReservedRoomKeys(reservations);
  if (roomKey && reservedKeys.has(roomKey)) return 'reserved';

  return getRoomStatus(roomKey || room?.roomNumber || room?.id);
}

export function getRoomStatusByKey(roomKey, reservations = [], rooms = []) {
  const normalizedKey = normalizeRoomKey(roomKey);
  if (!normalizedKey) return getRoomStatus(roomKey);

  const room = rooms.find(
    (r) => normalizeRoomKey(r.roomNumber || r.id) === normalizedKey,
  );

  if (room) {
    return getEffectiveRoomStatus(room, reservations);
  }

  const reservedKeys = getReservedRoomKeys(reservations);
  if (reservedKeys.has(normalizedKey)) return 'reserved';
  return getRoomStatus(normalizedKey);
}

export function getRoomName(roomNumber) {
  const floor = Number(String(roomNumber).charAt(0));
  const index = Number(String(roomNumber).slice(1)) - 1;
  const label = ROOM_LABELS[floor]?.[index] || `Room ${roomNumber}`;
  return `Room ${roomNumber}${label ? ' - ' + label : ''}`;
}

export function getRoomBuilding(roomNumber) {
  const floor = Number(String(roomNumber).charAt(0));
  return BUILDING_MAP[floor] || 'CICT BUILDING';
}

export function getRoomCapacity(roomNumber) {
  const floor = Number(String(roomNumber).charAt(0));
  const base = floor === 3 ? 30 : 25;
  const increment = (Number(String(roomNumber).slice(1)) % 5) * 5;
  return base + increment;
}

export function generateAllRooms() {
  const rooms = [];

  for (let floor = 1; floor <= 3; floor += 1) {
    for (let roomIndex = 1; roomIndex <= 10; roomIndex += 1) {
      const roomNumber = `${floor}${String(roomIndex).padStart(2, '0')}`;
      rooms.push({
        id: `room-${roomNumber}`,
        roomNumber,
        roomName: getRoomName(roomNumber),
        building: getRoomBuilding(roomNumber),
        floor,
        capacity: getRoomCapacity(roomNumber),
        status: getRoomStatus(roomNumber),
      });
    }
  }

  return rooms;
}

export function mergeRoomsWithDefaults(dbRooms) {
  const defaults = generateAllRooms();
  const roomMap = new Map();

  const normalizeKey = (value) => String(value).trim().replace(/^room-/, '');

  dbRooms.forEach((room) => {
    const key = room.roomNumber || room.id;
    if (key) {
      roomMap.set(normalizeKey(key), room);
    }
  });

  return defaults.map((room) => ({
    ...room,
    ...(roomMap.get(normalizeKey(room.roomNumber)) || {}),
  }));
}
