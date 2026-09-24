import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  ArrowRightIcon,
  ArrowSquareOutIcon,
  ArmchairIcon,
  BuildingsIcon,
  CheckIcon,
  CookingPotIcon,
  CopyIcon,
  DoorOpenIcon,
  DotsThreeIcon,
  FlameIcon,
  GearSixIcon,
  HeadphonesIcon,
  HouseIcon,
  LeafIcon,
  LightbulbFilamentIcon,
  MicrophoneIcon,
  MicrophoneSlashIcon,
  MoonStarsIcon,
  PauseIcon,
  PhoneDisconnectIcon,
  PlusIcon,
  RepeatIcon,
  SpeakerHighIcon,
  TrashIcon,
  UsersThreeIcon,
  XIcon,
} from '@phosphor-icons/react';
import { api } from './api';
import { useHouseRealtime } from './realtime';
import type { HouseRoom, HouseSnapshot, InvitePreview, Member, RoomKind } from './types';
import { useVoice } from './voice';

type ModalName = 'create-house' | 'add-room' | 'game' | 'invite' | 'manage' | 'room-settings' | null;

const roomIcons: Record<RoomKind, typeof ArmchairIcon> = {
  lounge: ArmchairIcon,
  kitchen: CookingPotIcon,
  sunroom: LeafIcon,
  loft: MoonStarsIcon,
};

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className={`brand ${compact ? 'brandCompact' : ''}`} aria-label="Roomcade home">
      <img src="/assets/house-character.webp" alt="" />
      <span>Roomcade</span>
    </Link>
  );
}

function LoadingShell() {
  return (
    <main className="loadingShell" aria-busy="true" aria-label="Opening Roomcade">
      <div className="skeleton skeletonBrand" />
      <div className="skeleton skeletonHero" />
      <div className="skeleton skeletonRow" />
    </main>
  );
}

function Failure({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <main className="centerPage">
      <img className="errorPet" src="/assets/house-character.webp" alt="Roomcade’s little House character" />
      <p className="eyebrow">The door stuck</p>
      <h1>We couldn’t get into the House.</h1>
      <p className="muted">{message}</p>
      {retry && <button className="button primary" onClick={retry}>Try again</button>}
    </main>
  );
}

function DialogShell({ open, onOpenChange, title, description, children }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: string; children: ReactNode }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialogOverlay" />
        <Dialog.Content className="dialogContent">
          <div className="dialogHead">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              {description && <Dialog.Description>{description}</Dialog.Description>}
            </div>
            <Dialog.Close className="iconButton quiet" aria-label="Close dialog"><XIcon size={18} /></Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function TextField({ label, name, defaultValue, placeholder, type = 'text', hint }: { label: string; name: string; defaultValue?: string; placeholder?: string; type?: string; hint?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input name={name} type={type} defaultValue={defaultValue} placeholder={placeholder} required />
      {hint && <small>{hint}</small>}
    </label>
  );
}

function App() {
  const bootstrap = useQuery({
    queryKey: ['bootstrap'],
    queryFn: async () => {
      await api.ensureSession();
      return api.bootstrap();
    },
  });

  if (bootstrap.isLoading) return <LoadingShell />;
  if (bootstrap.isError) return <Failure message={bootstrap.error.message} retry={() => bootstrap.refetch()} />;

  return (
    <Routes>
      <Route path="/" element={<Home houses={bootstrap.data?.houses ?? []} />} />
      <Route path="/join/:token" element={<JoinHouse />} />
      <Route path="/houses/:houseId" element={<HouseView />} />
      <Route path="/houses/:houseId/rooms/:roomId" element={<HouseView />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function Home({ houses }: { houses: Array<{ id: string; name: string; roomCount: number; memberCount: number; lastRoomId: string }> }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const create = useMutation({
    mutationFn: ({ name, displayName }: { name: string; displayName: string }) => api.createHouse(name, displayName),
    onSuccess: ({ house, inviteToken }) => {
      if (inviteToken) sessionStorage.setItem(`roomcade:invite:${house.id}`, inviteToken);
      void queryClient.invalidateQueries({ queryKey: ['bootstrap'] });
      navigate(`/houses/${house.id}/rooms/${house.rooms[0].id}`);
    },
    onError: (cause) => setError(cause.message),
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError('');
    const data = new FormData(event.currentTarget);
    create.mutate({ name: String(data.get('name')), displayName: String(data.get('displayName')) });
  };

  return (
    <main className="home">
      <header className="homeTop"><Brand /><button className="button primary" onClick={() => setCreateOpen(true)}><PlusIcon /> Create a House</button></header>
      <section className="homeHero">
        <div><p className="eyebrow">A place for your people</p><h1>Make yourself at home.</h1><p>A few friends, a few rooms, something good to play.</p></div>
        <img src="/assets/house-character.webp" alt="Roomcade’s little House character" />
      </section>
      <div className="sectionHeading"><h2>Your Houses</h2><span>Available in this browser</span></div>
      {houses.length ? (
        <div className="houseGrid">
          {houses.map((house) => (
            <Link className="houseCard" key={house.id} to={`/houses/${house.id}${house.lastRoomId ? `/rooms/${house.lastRoomId}` : ''}`}>
              <span className="homeSymbol"><HouseIcon size={26} /></span>
              <h3>{house.name}</h3>
              <span className="muted">{house.roomCount} {house.roomCount === 1 ? 'room' : 'rooms'} · {house.memberCount} {house.memberCount === 1 ? 'member' : 'members'}</span>
              <span className="enterLink">Come on in <ArrowRightIcon /></span>
            </Link>
          ))}
        </div>
      ) : (
        <button className="emptyHouse" onClick={() => setCreateOpen(true)}>
          <BuildingsIcon size={32} /><strong>Your first House starts with one Living Room.</strong><span>Make a cozy place and invite your people.</span>
        </button>
      )}
      <DialogShell open={createOpen} onOpenChange={setCreateOpen} title="A House of your own." description="Start small. There’s room for eight friends and four rooms.">
        <form onSubmit={submit} className="dialogForm">
          <TextField label="House name" name="name" placeholder="The Sunday Club" />
          <TextField label="Your name in this House" name="displayName" placeholder="What friends call you" />
          {error && <p className="formError" role="alert">{error}</p>}
          <div className="dialogActions"><Dialog.Close type="button" className="button">Not yet</Dialog.Close><button className="button primary" disabled={create.isPending}>Create House</button></div>
        </form>
      </DialogShell>
    </main>
  );
}

function JoinHouse() {
 const queryClient = useQueryClient();
 const knownHouses = queryClient.getQueryData<{houses: {id:string;lastRoomId:string}[]}>(["bootstrap"]);
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const [requestId, setRequestId] = useState(() => sessionStorage.getItem(`roomcade:join:${token}`) ?? '');
  const preview = useQuery({ queryKey: ['invite', token], queryFn: () => api.invitePreview(token), retry: false });
  const status = useQuery({ queryKey: ['join-status', requestId], queryFn: () => api.joinStatus(requestId), enabled: Boolean(requestId), refetchInterval: query => query.state.data?.status && query.state.data.status !== 'pending' ? false : 2500, retry: false });
  const request = useMutation({
    mutationFn: (displayName: string) => api.requestJoin(token, displayName),
    onSuccess: (result) => { setRequestId(result.id); sessionStorage.setItem(`roomcade:join:${token}`, result.id); },
  });
  useEffect(() => {
    if (status.data?.status === 'approved') { void queryClient.invalidateQueries({queryKey:['bootstrap']}); navigate(`/houses/${status.data.houseId}`, { replace: true }); }
  }, [navigate, status.data]);
  if (preview.isLoading) return <LoadingShell />;
  if (preview.isError) return <Failure message="This invite is invalid or has been rotated." />;
  const invite = preview.data as InvitePreview;
  const existing = knownHouses?.houses.find(house => house.id === invite.houseId);
  if (existing) return <Navigate to={`/houses/${existing.id}/rooms/${existing.lastRoomId}`} replace />;
  const terminal = status.isError || (status.data && status.data.status !== 'pending' && status.data.status !== 'approved');
  const resetRequest = () => { sessionStorage.removeItem(`roomcade:join:${token}`); setRequestId(''); };
  return (
    <main className="joinPage">
      <Brand />
      <section className="joinPanel">
        <img src="/assets/house-character.webp" alt="Roomcade’s little House character" />
        <p className="eyebrow">You’re invited in</p><h1>{invite.houseName}</h1>
        {terminal ? <div className="waiting"><h2>That request has ended.</h2><p>{status.isError ? 'Your request could not be found. You can ask to join again.' : status.data?.status === 'declined' ? 'The host declined this request.' : 'Your request expired or the invite changed.'}</p><button className="button" onClick={resetRequest}>Ask again</button></div> : requestId ? (
          <div className="waiting"><DoorOpenIcon size={28} /><h2>Knock, knock.</h2><p>Your request is with the House host. This page will open when they let you in.</p><span className="statusDot">Waiting for approval</span>{status.data?.status === 'declined' && <p className="formError">The host declined this request.</p>}</div>
        ) : invite.full ? <p className="notice errorNotice">This House is full right now.</p> : (
          <form className="dialogForm" onSubmit={(event) => { event.preventDefault(); request.mutate(String(new FormData(event.currentTarget).get('displayName'))); }}>
            <p>{invite.memberCount} of {invite.capacity} seats are taken. Pick a name and ask to join.</p>
            <TextField label="Your name" name="displayName" placeholder="What friends call you" />
            {request.error && <p className="formError" role="alert">{request.error.message}</p>}
            <button className="button primary wide" disabled={request.isPending}>Ask to join</button>
          </form>
        )}
      </section>
    </main>
  );
}

function HouseView() {
  const { houseId = '', roomId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const base = useQuery({ queryKey: ['house', houseId], queryFn: () => api.house(houseId), retry: false });
  const { snapshot, setSnapshot, connection, switchRoom } = useHouseRealtime(houseId, base.data);
  const [modal, setModal] = useState<ModalName>(null);
  const [notice, setNotice] = useState('');
  const [focusMode, setFocusMode] = useState(false);
  const [firePaused, setFirePaused] = useState(() => localStorage.getItem('roomcade:fire-paused') === 'true');
  const currentRoom = snapshot?.rooms.find((room) => room.id === roomId);
  const switching = useRef(false);
 const selfRoomId = snapshot?.members.find(member => member.id === snapshot.selfMemberId)?.activeRoomId ?? '';
 const voice = useVoice(houseId, selfRoomId, connection === 'connected' && Boolean(selfRoomId));
 const hostAway = snapshot?.members.find((member) => member.id === snapshot.hostMemberId)?.connected === false;

  useEffect(() => {
    if (snapshot && roomId && !currentRoom) navigate(`/houses/${houseId}`, { replace: true });
  }, [currentRoom, houseId, navigate, roomId, snapshot]);

  useEffect(() => {
    if (connection !== 'connected' || !roomId || !currentRoom || !selfRoomId || roomId === selfRoomId || switching.current) return;
    switching.current = true;
    void switchRoom(roomId).catch(error => {
      setNotice(error.message);
      navigate(`/houses/${houseId}/rooms/${selfRoomId}`, { replace: true });
    }).finally(() => { switching.current = false; });
  }, [connection, roomId, selfRoomId, currentRoom, switchRoom, navigate, houseId]);

  if (base.isError) return <Failure message="This House is unavailable or this browser is no longer a member." retry={() => base.refetch()} />;
  if (base.isLoading || !snapshot) return <LoadingShell />;

  const update = (next: HouseSnapshot) => { setSnapshot(next); setNotice('Saved for everyone in the House.'); window.setTimeout(() => setNotice(''), 3500); };
  const enterRoom = async (target: HouseRoom) => {
    if (switching.current) return;
    switching.current = true;
    try {
      if (target.id !== selfRoomId) await switchRoom(target.id);
      navigate(`/houses/${houseId}/rooms/${target.id}`);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not enter this room.'); }
    finally { switching.current = false; }
  };
  const toggleFire = () => { const next = !firePaused; setFirePaused(next); localStorage.setItem('roomcade:fire-paused', String(next)); };

  return (
    <div className={`houseApp ${focusMode ? 'focusMode' : ''} ${firePaused ? 'firePaused' : ''}`}>
      <div ref={voice.audioRoot} hidden />
      <HouseTopBar house={snapshot} connection={connection} onModal={setModal} />
      <RoomTabs house={snapshot} activeRoomId={roomId} onRoom={enterRoom} onAdd={() => setModal('add-room')} />
      {connection !== 'connected' && <div className={`connectionNotice ${connection === 'replaced' ? 'errorNotice' : ''}`} role="status">{connection === 'replaced' ? 'This House opened in another tab. Close this tab or refresh to take over.' : 'Reconnecting to the House…'}</div>}
      {connection === 'connected' && hostAway && <div className="connectionNotice" role="status">The House host is away. If they do not return within 30 seconds, Roomcade will pass the keys to the longest-standing person here.</div>}
      {roomId && currentRoom ? (
        <RoomScene voice={voice} house={snapshot} room={currentRoom} onGame={() => setModal('game')} onRoomSettings={() => setModal('room-settings')} onFire={toggleFire} firePaused={firePaused} focusMode={focusMode} onFocusMode={() => setFocusMode((value) => !value)} />
      ) : <HouseOverview house={snapshot} onRoom={enterRoom} onAdd={() => setModal('add-room')} />}
      {notice && <div className="toast" role="status">{notice}</div>}
      <HouseDialogs modal={modal} setModal={setModal} house={snapshot} room={currentRoom} onSnapshot={update} onRefresh={() => queryClient.invalidateQueries({ queryKey: ['bootstrap'] })} />
      <div className="srOnly" aria-live="polite">{notice}</div>
    </div>
  );
}

function HouseTopBar({ house, connection, onModal }: { house: HouseSnapshot; connection: string; onModal: (modal: ModalName) => void }) {
  return (
    <header className="houseTop">
      <Brand compact />
      <DropdownMenu.Root>
        <DropdownMenu.Trigger className="housePicker"><HouseIcon /><span>{house.name}</span><DotsThreeIcon /></DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className="menuContent" align="start" sideOffset={8}>
            <DropdownMenu.Item asChild><Link to="/" className="menuItem"><BuildingsIcon /> Your Houses</Link></DropdownMenu.Item>
            <DropdownMenu.Item asChild><Link to={`/houses/${house.id}`} className="menuItem"><HouseIcon /> House overview</Link></DropdownMenu.Item>
            <DropdownMenu.Separator className="menuSeparator" />
            <DropdownMenu.Item className="menuItem" onSelect={() => onModal('invite')}><CopyIcon /> Invite people</DropdownMenu.Item>
            {house.permissions.isHost && <DropdownMenu.Item className="menuItem" onSelect={() => onModal('manage')}><GearSixIcon /> House keeping {Boolean(house.pendingRequests?.length) && <span className="count">{house.pendingRequests?.length}</span>}</DropdownMenu.Item>}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      {house.permissions.isHost && Boolean(house.pendingRequests?.length) && <button className="button" onClick={() => onModal('manage')}>Join requests ({house.pendingRequests?.length})</button>}
      <div className="houseMeta"><span className={`connectionDot ${connection}`} />{house.members.filter((member) => member.connected).length} here</div>
    </header>
  );
}

function RoomTabs({ house, activeRoomId, onRoom, onAdd }: { house: HouseSnapshot; activeRoomId?: string; onRoom: (room: HouseRoom) => void; onAdd: () => void }) {
  return (
    <nav className="roomTabs" aria-label="Rooms">
      {house.rooms.map((room) => { const Icon = roomIcons[room.kind]; const count = house.members.filter((member) => member.activeRoomId === room.id && member.connected).length; return (
        <button key={room.id} className="roomTab" aria-current={room.id === activeRoomId ? 'page' : undefined} onClick={() => onRoom(room)}><Icon /><span>{room.name}</span><small>{count}</small></button>
      ); })}
      {house.permissions.isHost && house.rooms.length < 4 && <button className="roomTab addTab" onClick={onAdd} aria-label="Add room"><PlusIcon /></button>}
    </nav>
  );
}

function HouseOverview({ house, onRoom, onAdd }: { house: HouseSnapshot; onRoom: (room: HouseRoom) => void; onAdd: () => void }) {
  return (
    <main className="overview">
      <header className="overviewHero"><div><p className="eyebrow">A place for your people</p><h1>{house.name}</h1><p>A few rooms. Good company. Find your spot.</p></div><img src="/assets/house-character.webp" alt="Roomcade’s little House character" /></header>
      <section className="floorplan" aria-label="House floor plan">
        {house.rooms.map((room) => { const Icon = roomIcons[room.kind]; const people = house.members.filter((member) => member.activeRoomId === room.id && member.connected).length; return (
          <button key={room.id} className={`planRoom kind-${room.kind}`} onClick={() => onRoom(room)}><span className="planTop"><Icon /><small>{people} here</small></span><strong>{room.name}</strong><span>{room.game ? 'Codenames' : 'Just hanging out'} <ArrowSquareOutIcon /></span></button>
        ); })}
        {house.permissions.isHost && house.rooms.length < 4 && <button className="planRoom vacant" onClick={onAdd}><PlusIcon /><span>Make a room</span></button>}
      </section>
      <p className="planFoot">{house.members.length} of 8 members · {house.rooms.length} of 4 rooms</p>
    </main>
  );
}

function RoomScene({ voice, house, room, onGame, onRoomSettings, onFire, firePaused, focusMode, onFocusMode }: { house: HouseSnapshot; room: HouseRoom; onGame: () => void; onRoomSettings: () => void; onFire: () => void; firePaused: boolean; focusMode: boolean; onFocusMode: () => void; voice: ReturnType<typeof useVoice> }) {
  const members = house.members.filter((member) => member.activeRoomId === room.id && member.connected);
  return (
    <main className="roomScene">
      <div className="scenery" aria-hidden="true"><div className="ceilingArt" /><div className="roomArt" /><Firelight /></div>
      <section className="roomContent">
        <header className="roomHeading"><div><p className="eyebrow">{members.length ? `${members.length} here now` : 'A quiet room'}</p><h1>{room.name}</h1></div><div className="roomActions"><button className="iconButton surface" onClick={onFire} aria-label={firePaused ? 'Play fire animation' : 'Pause fire animation'}>{firePaused ? <FlameIcon /> : <PauseIcon />}</button>{house.permissions.isHost && <button className="iconButton surface" onClick={onRoomSettings} aria-label="Room settings"><GearSixIcon /></button>}</div></header>
        <GameSurface room={room} selfMemberId={house.selfMemberId} isHost={house.permissions.isHost} onManage={onGame} focusMode={focusMode} onFocusMode={onFocusMode} />
        <PeopleVoiceBar voice={voice} house={house} room={room} members={members} />
      </section>
    </main>
  );
}

function Firelight() {
  return <div className="firelight"><span className="flame flameOne" /><span className="flame flameTwo" /><i className="ember emberOne" /><i className="ember emberTwo" /><i className="ember emberThree" /></div>;
}

function GameSurface({ room, selfMemberId, isHost, onManage, focusMode, onFocusMode }: { room: HouseRoom; selfMemberId: string; isHost: boolean; onManage: () => void; focusMode: boolean; onFocusMode: () => void }) {
  const queryClient = useQueryClient();
  const embeddingEnabled = queryClient.getQueryData<{embeddingEnabled:boolean}>(['bootstrap'])?.embeddingEnabled ?? false;
  const [frameKey, setFrameKey] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => { setLoaded(false); setTimedOut(false); const timer = window.setTimeout(() => setTimedOut(true), 12_000); return () => window.clearTimeout(timer); }, [frameKey, room.game?.url]);
  const canManage = !room.game || room.game.coordinatorMemberId === selfMemberId || isHost;
  if (!room.game) return (
    <section className="emptyGame">
      <div className="emptyGameInner"><LightbulbFilamentIcon size={34} /><p className="eyebrow">The table is clear</p><h2>Bring Codenames in.</h2><p>Create a private lobby, then share its room link here. Everyone gets their own view of the same match.</p><button className="button primary" onClick={onManage}>Set up Codenames</button></div>
    </section>
  );
  if (!embeddingEnabled) return <section className="emptyGame"><div className="emptyGameInner"><p className="eyebrow">The table is ready</p><h2>Codenames</h2><p>Open the shared lobby to play. Keep Roomcade open for your room’s voice chat.</p><a className="button primary" href={room.game.url} target="_blank" rel="noreferrer">Open Codenames</a>{canManage && <button className="button" onClick={onManage}>Manage game</button>}</div></section>;
  return (
    <section className="gameSurface">
      <div className="gameToolbar"><div><strong>Codenames</strong><span>Shared room · separate player views</span></div><div className="toolbarActions"><button className="button quiet" onClick={onFocusMode}>{focusMode ? 'Return to room' : 'Focus game'}</button><button className="iconButton quiet" onClick={() => { setFrameKey((key) => key + 1); setLoaded(false); }} aria-label="Reload game for me"><RepeatIcon /></button><a className="iconButton quiet" href={room.game.url} target="_blank" rel="noreferrer" aria-label="Open Codenames in another tab"><ArrowSquareOutIcon /></a>{canManage && <button className="iconButton quiet" onClick={onManage} aria-label="Manage game"><DotsThreeIcon /></button>}</div></div>
      {!loaded && <div className="gameSkeleton" aria-label="Codenames is loading"><div /><div /><div /><div /><div /></div>}
      <iframe key={`${room.id}:${frameKey}:${room.game.url}`} className={loaded ? 'loaded' : ''} src={room.game.url} title={`Codenames in ${room.name}`} allow="fullscreen" referrerPolicy="strict-origin-when-cross-origin" onLoad={() => { setLoaded(true); setTimedOut(false); }} />
      {timedOut && !loaded && <div className="frameFallback"><p>Codenames is taking longer than expected.</p><a className="button primary" href={room.game.url} target="_blank" rel="noreferrer">Open in another window</a></div>}
    </section>
  );
}

function PeopleVoiceBar({ voice, house, room, members }: { house: HouseSnapshot; room: HouseRoom; members: Member[]; voice: ReturnType<typeof useVoice> }) {
  return (
    <section className="peopleVoice" aria-label={`People and voice in ${room.name}`}>
      <div className="peopleList">
        {members.length ? members.map((member, index) => <div className="person" key={member.id}><span className={`avatar tone-${index % 4}`}>{member.displayName.slice(0, 1).toUpperCase()}<i className="presenceDot" /></span><span>{member.displayName}{member.id === house.selfMemberId && <small>you</small>}</span>{member.role === 'host' && <HouseIcon aria-label="House host" />}</div>) : <p className="muted">No one else is here yet.</p>}
      </div>
      <div className="voiceCluster">
        <span className={`voiceStatus ${voice.state}`}>{voice.state === 'connected' ? <SpeakerHighIcon /> : <HeadphonesIcon />}{voice.message}</span>
        <div className="voiceActions">
          {(!voice.desired || voice.state === 'error') ? <button className="button primary" onClick={voice.join}><HeadphonesIcon /> Join voice</button> : <><button className="button" onClick={voice.toggleMute} disabled={voice.state === 'connecting' || voice.state === 'reconnecting'}>{voice.muted ? <MicrophoneSlashIcon /> : <MicrophoneIcon />}{voice.state === 'listen-only' ? 'Enable microphone' : voice.muted ? 'Unmute' : 'Mute'}</button><button className="iconButton danger" onClick={voice.leave} aria-label="Leave voice"><PhoneDisconnectIcon /></button></>}
        </div>
        {voice.needsAudio && <button className="button" onClick={voice.enableAudio}>Enable sound</button>}
      </div>
    </section>
  );
}

function HouseDialogs({ modal, setModal, house, room, onSnapshot, onRefresh }: { modal: ModalName; setModal: (modal: ModalName) => void; house: HouseSnapshot; room?: HouseRoom; onSnapshot: (snapshot: HouseSnapshot) => void; onRefresh: () => void }) {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [inviteToken, setInviteToken] = useState(() => sessionStorage.getItem(`roomcade:invite:${house.id}`) ?? '');
  const close = () => { setError(''); setModal(null); };
  const perform = async (task: () => Promise<HouseSnapshot>) => { setError(''); try { onSnapshot(await task()); close(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'That did not work.'); } };
  const submitRoom = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); void perform(() => api.createRoom(house.id, String(data.get('name')), String(data.get('kind')) as RoomKind)); };
  const submitGame = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!room) return; if (room.game && !window.confirm('Replace the shared game for everyone in this room? The old match will remain on Codenames.')) return; const data = new FormData(event.currentTarget); void perform(() => api.setGame(house.id, room.id, String(data.get('url')), room.game?.revision ?? 0)); };
  const submitRoomSettings = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!room) return; const data = new FormData(event.currentTarget); void perform(() => api.updateRoom(house.id, room.id, String(data.get('name')), String(data.get('kind')) as RoomKind)); };
  const inviteURL = inviteToken ? `${location.origin}/join/${inviteToken}` : '';
  return <>
    <DialogShell open={modal === 'add-room'} onOpenChange={(open) => !open && close()} title="Make a little room." description={`A new corner of ${house.name}.`}><form className="dialogForm" onSubmit={submitRoom}><TextField label="Room name" name="name" placeholder="The sunroom" /><label className="field"><span>A little personality</span><select name="kind" defaultValue="sunroom"><option value="sunroom">Sunroom · soft sage</option><option value="kitchen">Kitchen · warm clay</option><option value="loft">Loft · quiet lavender</option><option value="lounge">Lounge · soft sage</option></select></label>{error && <p className="formError">{error}</p>}<div className="dialogActions"><button type="button" className="button" onClick={close}>Cancel</button><button className="button primary">Add room</button></div></form></DialogShell>
    <DialogShell open={modal === 'game'} onOpenChange={(open) => !open && close()} title={room?.game ? 'Bring a new game to the table.' : 'Bring your Codenames lobby.'} description="The person who creates the Codenames lobby keeps its Admin controls."><form className="dialogForm" onSubmit={submitGame}><ol className="steps"><li><span>1</span><div>Create a private Codenames lobby.<br/><a href="https://codenames.game" target="_blank" rel="noreferrer">Open Codenames <ArrowSquareOutIcon /></a></div></li><li><span>2</span><div>Paste its private room URL below.</div></li></ol><TextField label="Private room URL" name="url" type="url" defaultValue={room?.game?.url} placeholder="https://codenames.game/r/…" hint="Only the exact private room link is accepted." />{error && <p className="formError">{error}</p>}<div className="dialogActions">{room?.game && <button type="button" className="button danger" onClick={() => { if (window.confirm('Clear the shared game for this room? This does not delete the Codenames match.')) void perform(() => api.clearGame(house.id, room.id, room.game!.revision)); }}><TrashIcon /> Clear game</button>}<button className="button primary">{room?.game ? 'Replace for everyone' : 'Bring game into room'}</button></div></form></DialogShell>
    <DialogShell open={modal === 'room-settings'} onOpenChange={(open) => !open && close()} title="Settle this room." description="A room’s personality changes its small accent, not the fireside."><form className="dialogForm" onSubmit={submitRoomSettings}><TextField label="Room name" name="name" defaultValue={room?.name} /><label className="field"><span>Room personality</span><select name="kind" defaultValue={room?.kind}><option value="lounge">Lounge</option><option value="kitchen">Kitchen</option><option value="sunroom">Sunroom</option><option value="loft">Loft</option></select></label>{error && <p className="formError">{error}</p>}<div className="dialogActions">{room && house.rooms.length > 1 && <button type="button" className="button danger" onClick={() => { if (window.confirm(`Delete ${room.name}? A room with people inside cannot be deleted.`)) void perform(() => api.deleteRoom(house.id, room.id)); }}><TrashIcon /> Delete room</button>}<button className="button primary">Save room</button></div></form></DialogShell>
    <DialogShell open={modal === 'invite'} onOpenChange={(open) => !open && close()} title="Good company starts here." description="New friends ask to join. The House host chooses who comes in."><div className="dialogForm">{inviteURL ? <label className="field"><span>House invite</span><input readOnly value={inviteURL} /></label> : <p className="notice">Generate a fresh invite when you are ready to share it.</p>}{error && <p className="formError">{error}</p>}<div className="dialogActions">{inviteURL && <button className="button" onClick={async () => { try { await navigator.clipboard.writeText(inviteURL); } catch { setError('Copy was unavailable. Select the link above and copy it.'); } }}><CopyIcon /> Copy</button>}{house.permissions.isHost && <button className="button primary" onClick={async () => { try { const result = await api.rotateInvite(house.id); setInviteToken(result.inviteToken); sessionStorage.setItem(`roomcade:invite:${house.id}`, result.inviteToken); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Invite creation failed.'); } }}><RepeatIcon /> {inviteURL ? 'Rotate invite' : 'Generate invite'}</button>}</div><small className="muted">{house.members.length}/8 members · host approval required. Rotating invalidates the previous link and pending requests.</small></div></DialogShell>
    <DialogShell open={modal === 'manage'} onOpenChange={(open) => !open && close()} title="House keeping" description={`${house.members.length} of 8 seats are taken.`}><div className="manageList"><form className="compactForm" onSubmit={(event) => { event.preventDefault(); void perform(() => api.updateHouse(house.id, String(new FormData(event.currentTarget).get('name')))); }}><TextField label="House name" name="name" defaultValue={house.name} /><button className="button">Save name</button></form>{Boolean(house.pendingRequests?.length) && <section><p className="eyebrow">Someone’s at the door</p>{house.pendingRequests?.map((request) => <div className="memberRow" key={request.id}><Avatar member={{ displayName: request.displayName } as Member} /><strong>{request.displayName}</strong><div><button className="button quiet" onClick={async () => { try { await api.decideJoin(house.id, request.id, 'decline'); close(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not decline request.'); } }}>Decline</button><button className="button primary" onClick={async () => { try { await api.decideJoin(house.id, request.id, 'approve'); close(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not approve request.'); } }}>Let in</button></div></div>)}</section>}<section><p className="eyebrow">The people make the House</p>{house.members.map((member) => <div className="memberRow" key={member.id}><Avatar member={member} /><span><strong>{member.displayName}</strong><small>{member.role === 'host' ? 'House host' : member.connected ? 'Here now' : 'Offline'}</small></span>{member.id !== house.selfMemberId && <div>{house.permissions.isHost && member.role !== 'host' && <button className="button quiet" onClick={() => void perform(() => api.transferHost(house.id, member.id))}>Make host</button>}{house.permissions.isHost && <button className="iconButton danger" aria-label={`Remove ${member.displayName}`} onClick={async () => { if (!window.confirm(`Remove ${member.displayName} from this House? They will need approval to return.`)) return; try { await api.removeMember(house.id, member.id); close(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not remove member.'); } }}><TrashIcon /></button>}</div>}</div>)}</section>{error && <p className="formError">{error}</p>}<div className="dialogActions"><button className="button danger" onClick={async () => { if (!window.confirm(`Delete ${house.name} and all of its rooms? This cannot be undone.`)) return; try { await api.deleteHouse(house.id); onRefresh(); navigate('/'); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not delete the House.'); } }}><TrashIcon /> Delete House</button><button className="button" onClick={() => { close(); onRefresh(); }}>Done</button></div></div></DialogShell>
  </>;
}

function Avatar({ member }: { member: Member }) { return <span className="avatar">{member.displayName.slice(0, 1).toUpperCase()}</span>; }

export default App;
