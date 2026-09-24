export type RoomKind = 'lounge' | 'kitchen' | 'sunroom' | 'loft';

export interface Game {
  provider: 'codenames';
  url: string;
  coordinatorMemberId: string;
  revision: number;
}

export interface HouseRoom {
  id: string;
  name: string;
  kind: RoomKind;
  position: number;
  game?: Game;
}

export interface Member {
  id: string;
  displayName: string;
  role: 'host' | 'member';
  activeRoomId: string;
  connected: boolean;
  joinedAt: number;
}

export interface JoinRequest {
  id: string;
  displayName: string;
  status: string;
  expiresAt: number;
}

export interface HouseSnapshot {
  id: string;
  name: string;
  hostMemberId: string;
  revision: number;
  presenceVersion: number;
  expiresAt: number;
  rooms: HouseRoom[];
  members: Member[];
  pendingRequests?: JoinRequest[];
  selfMemberId: string;
  permissions: { isHost: boolean; canManageHouse: boolean };
  mediaGeneration: number;
}

export interface HouseSummary {
  id: string;
  name: string;
  roomCount: number;
  memberCount: number;
  lastRoomId: string;
}

export interface Bootstrap {
  embeddingEnabled: boolean;
  sessionId: string;
  houses: HouseSummary[];
}

export interface InvitePreview {
  houseId: string;
  houseName: string;
  memberCount: number;
  capacity: number;
  full: boolean;
}

export class APIError extends Error {
  code: string;
  requestId?: string;

  constructor(message: string, code = 'request_failed', requestId?: string) {
    super(message);
    this.code = code;
    this.requestId = requestId;
  }
}
