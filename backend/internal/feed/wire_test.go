package feed

import (
	"encoding/json"
	"os"
	"reflect"
	"testing"

	"google.golang.org/protobuf/proto"

	"rail-announcements-backend/internal/feed/livepb"
)

// The .pb files are frames written by the feed service's own encoder, and each .json
// beside one is the same message as the websites' types spell it.
func TestDecodeReadsTheServiceFrames(t *testing.T) {
	for _, name := range []string{"passing", "platform_alteration", "td_unknown", "announcement_audio"} {
		frame, err := os.ReadFile("testdata/" + name + ".pb")
		if err != nil {
			t.Fatal(err)
		}
		decoded, err := Decode(frame)
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		got, ok := decoded.(*Announcement)
		if !ok {
			t.Fatalf("%s: decoded to %T", name, decoded)
		}

		raw, err := os.ReadFile("testdata/" + name + ".json")
		if err != nil {
			t.Fatal(err)
		}
		var want Announcement
		if err := json.Unmarshal(raw, &want); err != nil {
			t.Fatal(err)
		}
		if !reflect.DeepEqual(normalise(t, *got), normalise(t, want)) {
			gotJSON, _ := json.MarshalIndent(got, "", " ")
			wantJSON, _ := json.MarshalIndent(want, "", " ")
			t.Errorf("%s differs:\n got %s\nwant %s", name, gotJSON, wantJSON)
		}
	}
}

// normalise compares by value through JSON, because a decoded time and a
// parsed one are equal instants with different representations.
func normalise(t *testing.T, a Announcement) any {
	t.Helper()
	raw, err := json.Marshal(a)
	if err != nil {
		t.Fatal(err)
	}
	var out any
	if err := json.Unmarshal(raw, &out); err != nil {
		t.Fatal(err)
	}
	return out
}

func TestDecodeRejectsOtherVersionsAndIgnoresUnknownPayloads(t *testing.T) {
	if _, err := Decode([]byte{0x08, 0x01}); err == nil {
		t.Error("version 1 was accepted")
	}
	if _, err := Decode([]byte("not protobuf")); err == nil {
		t.Error("garbage was accepted")
	}
	decoded, err := Decode([]byte{0x08, 0x02})
	if decoded != nil || err != nil {
		t.Errorf("a message with no payload gave %v, %v", decoded, err)
	}
}

// A link carries the links of its own service, and a direction that is unset
// until Darwin gives one, so both have to survive decoding at every depth.
func TestDecodeReadsLinksAtEveryDepth(t *testing.T) {
	yes, no := true, false
	frame, err := proto.Marshal(&livepb.ServerMessage{Version: ProtocolVersion, Payload: &livepb.ServerMessage_Announcement{
		Announcement: &livepb.Announcement{
			AnnouncementType: livepb.AnnouncementType_ANNOUNCEMENT_TYPE_NEXT,
			Details: &livepb.Movement{Mode: livepb.TransportMode_TRANSPORT_MODE_TRAIN, Portions: []*livepb.Portion{
				{Rid: "bus", Category: "LK", Mode: livepb.TransportMode_TRANSPORT_MODE_BUS, Main: &yes, Links: []*livepb.Portion{
					{Rid: "train", Category: "LK", Links: []*livepb.Portion{{Rid: "back", Category: "LK", Main: &no}}},
				}},
			}},
		},
	}})
	if err != nil {
		t.Fatal(err)
	}
	decoded, err := Decode(frame)
	if err != nil {
		t.Fatal(err)
	}
	details := decoded.(*Announcement).Details
	bus := details.Portions[0]
	if details.Mode != "train" || bus.Main == nil || !*bus.Main || *bus.Mode != "bus" || len(bus.Links) != 1 {
		t.Fatalf("the link to the bus decoded to %+v", bus)
	}
	train := bus.Links[0]
	if train.RID != "train" || train.Main != nil || train.Mode != nil || len(train.Links) != 1 {
		t.Fatalf("the bus's link decoded to %+v", train)
	}
	if back := train.Links[0]; back.RID != "back" || back.Main == nil || *back.Main || len(back.Links) != 0 {
		t.Fatalf("the last link decoded to %+v", back)
	}
}
