package app

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/livekit/protocol/auth"
	"github.com/livekit/protocol/livekit"
	"github.com/twitchtv/twirp"
)

// Cloud revokes this identity's existing tokens even when the participant has
// already disconnected. Each committed room switch gets a new identity.
func (a *App) revokeVoice(ctx context.Context, member membership) error {
	if a.cfg.LiveKitURL == "" || a.cfg.LiveKitAPIKey == "" || a.cfg.LiveKitSecret == "" {
		return nil
	}
	room := "roomcade_" + member.LastRoomID
	token, err := auth.NewAccessToken(a.cfg.LiveKitAPIKey, a.cfg.LiveKitSecret).
		SetValidFor(time.Minute).AddGrant(&auth.VideoGrant{RoomAdmin: true, Room: room}).ToJWT()
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	ctx, err = twirp.WithHTTPRequestHeaders(ctx, http.Header{"Authorization": {"Bearer " + token}})
	if err != nil {
		return err
	}
	endpoint := strings.Replace(strings.Replace(a.cfg.LiveKitURL, "wss://", "https://", 1), "ws://", "http://", 1)
	client := livekit.NewRoomServiceProtobufClient(endpoint, &http.Client{Timeout: 5 * time.Second})
	_, err = client.RemoveParticipant(ctx, &livekit.RoomParticipantIdentity{Room: room, Identity: fmt.Sprintf("%s_%d", member.ID, member.MediaGeneration)})
	if failure, ok := err.(twirp.Error); ok && failure.Code() == twirp.NotFound {
		return nil
	}
	return err
}
