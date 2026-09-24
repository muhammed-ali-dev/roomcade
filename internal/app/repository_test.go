package app

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"testing"
)

func testStore(t *testing.T) *Store {
	t.Helper()
	store, err := OpenStore(filepath.Join(t.TempDir(), "roomcade.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = store.Close() })
	return store
}

func TestNormalizeCodenamesURL(t *testing.T) {
	valid := []string{
		"https://codenames.game/r/maple-room",
		" https://codenames.game/r/maple_room/ ",
	}
	for _, raw := range valid {
		if _, err := normalizeCodenamesURL(raw); err != nil {
			t.Errorf("expected %q to be valid: %v", raw, err)
		}
	}
	invalid := []string{
		"http://codenames.game/r/maple",
		"https://play.codenames.game/r/maple",
		"https://codenames.game/r/maple?role=admin",
		"https://codenames.game/",
		"https://name:secret@codenames.game/r/maple",
	}
	for _, raw := range invalid {
		if _, err := normalizeCodenamesURL(raw); err == nil {
			t.Errorf("expected %q to be rejected", raw)
		}
	}
}

func TestHouseRoomAndGameLifecycle(t *testing.T) {
	ctx := context.Background()
	store := testStore(t)
	hostSession, _, err := store.createSession(ctx)
	if err != nil {
		t.Fatal(err)
	}
	house, _, err := store.createHouse(ctx, hostSession.ID, "The Sunday Club", "Mara")
	if err != nil {
		t.Fatal(err)
	}
	for _, room := range []struct{ name, kind string }{{"Kitchen", "kitchen"}, {"Sunroom", "sunroom"}, {"Loft", "loft"}} {
		if err := store.createRoom(ctx, house.ID, hostSession.ID, room.name, room.kind); err != nil {
			t.Fatal(err)
		}
	}
	if err := store.createRoom(ctx, house.ID, hostSession.ID, "Fifth room", "lounge"); !errors.Is(err, errConflict) {
		t.Fatalf("expected room cap conflict, got %v", err)
	}
	roomID := house.Rooms[0].ID
	if err := store.setGame(ctx, house.ID, roomID, hostSession.ID, "https://codenames.game/r/maple-room", 0); err != nil {
		t.Fatal(err)
	}
	snapshot, err := store.snapshot(ctx, house.ID, hostSession.ID, nil, 1)
	if err != nil {
		t.Fatal(err)
	}
	if snapshot.Rooms[0].Game == nil || snapshot.Rooms[0].Game.URL != "https://codenames.game/r/maple-room" {
		t.Fatalf("game was not persisted: %#v", snapshot.Rooms[0].Game)
	}
	if err := store.clearGame(ctx, house.ID, roomID, hostSession.ID, 99); !errors.Is(err, errConflict) {
		t.Fatalf("expected stale revision conflict, got %v", err)
	}
}

func TestInviteApprovalIsCapacityCheckedAndDurable(t *testing.T) {
	ctx := context.Background()
	store := testStore(t)
	hostSession, _, _ := store.createSession(ctx)
	house, invite, err := store.createHouse(ctx, hostSession.ID, "Lantern House", "Inez")
	if err != nil {
		t.Fatal(err)
	}
	guestSession, _, _ := store.createSession(ctx)
	req, err := store.requestJoin(ctx, invite, guestSession.ID, "Rowan")
	if err != nil {
		t.Fatal(err)
	}
	if err = store.decideJoin(ctx, house.ID, req.ID, hostSession.ID, "approve"); err != nil {
		t.Fatal(err)
	}
	snapshot, err := store.snapshot(ctx, house.ID, guestSession.ID, nil, 1)
	if err != nil {
		t.Fatal(err)
	}
	if len(snapshot.Members) != 2 || snapshot.Permissions.IsHost {
		t.Fatalf("unexpected approved snapshot: %#v", snapshot)
	}
}

func TestHouseRejectsNinthApprovedMember(t *testing.T) {
	ctx := context.Background()
	store := testStore(t)
	hostSession, _, _ := store.createSession(ctx)
	house, invite, err := store.createHouse(ctx, hostSession.ID, "Eight Chairs", "Nico")
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 7; i++ {
		guest, _, createErr := store.createSession(ctx)
		if createErr != nil {
			t.Fatal(createErr)
		}
		req, requestErr := store.requestJoin(ctx, invite, guest.ID, fmt.Sprintf("Friend %d", i+1))
		if requestErr != nil {
			t.Fatal(requestErr)
		}
		if approveErr := store.decideJoin(ctx, house.ID, req.ID, hostSession.ID, "approve"); approveErr != nil {
			t.Fatal(approveErr)
		}
	}
	ninth, _, _ := store.createSession(ctx)
	if _, err := store.requestJoin(ctx, invite, ninth.ID, "One Too Many"); !errors.Is(err, errConflict) {
		t.Fatalf("expected the ninth member to be rejected, got %v", err)
	}
}
