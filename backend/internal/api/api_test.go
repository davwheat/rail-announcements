package api

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/timestamppb"

	"rail-announcements-backend/internal/audio"
	"rail-announcements-backend/internal/feed"
	"rail-announcements-backend/internal/feed/livepb"
	"rail-announcements-backend/internal/helppoint"
	"rail-announcements-backend/internal/stream"
)

const audioDirectory = "../../../audio"

type testLog struct{ t *testing.T }

func (l testLog) Infof(format string, args ...any) { l.t.Logf(format, args...) }
func (l testLog) Warnf(format string, args ...any) { l.t.Logf("WARN "+format, args...) }

func library(t *testing.T) *audio.Library {
	t.Helper()
	if _, err := os.Stat(audioDirectory + "/station/ketech/phil"); err != nil {
		t.Skip("the audio directory is not checked out")
	}
	lib, err := audio.NewLibrary(audioDirectory, "", 128<<20)
	if err != nil {
		t.Skip(err)
	}
	return lib
}

// fakeFeed serves one announcement stream: ready, then a next train
// announcement for the stopping service in the feed's snapshot fixture.
// The fixture's stations are invented, so they are renamed to recorded ones.
func fakeFeed(t *testing.T) *httptest.Server {
	t.Helper()
	raw, err := os.ReadFile("../feed/testdata/stopping_snapshot.pb")
	if err != nil {
		t.Fatal(err)
	}
	var snapshot livepb.ServerMessage
	if err := proto.Unmarshal(raw, &snapshot); err != nil {
		t.Fatal(err)
	}
	movement := snapshot.GetSnapshot().GetMovements()[0]
	recorded := map[string]string{"TST": "KGX", "ORG": "KGX", "JNC": "SVG", "DST": "CBG"}
	rename := func(l *livepb.Location) {
		if code, ok := recorded[l.GetCrs()]; ok {
			l.Crs = &code
		}
	}
	rename(movement.GetStation())
	for _, endpoint := range append(movement.GetOrigins(), movement.GetDestinations()...) {
		rename(endpoint.GetLocation())
		for i, crs := range endpoint.GetVia().GetLocs() {
			endpoint.Via.Locs[i] = recorded[crs]
		}
	}
	for _, call := range movement.GetCallingPoints() {
		rename(call.GetLocation())
	}
	fixture := livepb.ServerMessage{Version: 2, Payload: &livepb.ServerMessage_Announcement{Announcement: &livepb.Announcement{
		EventId:          "next:" + movement.GetId(),
		AnnouncementType: livepb.AnnouncementType_ANNOUNCEMENT_TYPE_NEXT,
		MovementId:       movement.GetId(),
		Station:          movement.GetStation(),
		CreatedAt:        timestamppb.Now(),
		Details:          movement,
	}}}
	upgrader := websocket.Upgrader{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/announcements/live" || r.URL.Query().Get("crs") != "KGX" {
			http.Error(w, "unexpected request "+r.URL.String(), http.StatusBadRequest)
			return
		}
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer conn.Close()
		send := func(message *livepb.ServerMessage) {
			frame, _ := proto.Marshal(message)
			conn.WriteMessage(websocket.BinaryMessage, frame)
		}
		announcement := proto.Clone(&fixture).(*livepb.ServerMessage)
		station := announcement.GetAnnouncement().GetStation()
		send(&livepb.ServerMessage{Version: 2, Payload: &livepb.ServerMessage_Ready{Ready: &livepb.Ready{Station: station, Healthy: true, CreatedAt: timestamppb.Now()}}})
		// Long enough for the stream to be up and listening.
		time.Sleep(500 * time.Millisecond)
		announcement.GetAnnouncement().ExpiresAt = timestamppb.New(time.Now().Add(time.Minute))
		send(announcement)
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				return
			}
		}
	}))
	t.Cleanup(server.Close)
	return server
}

func TestAListenerHearsAnAnnouncementOverHLS(t *testing.T) {
	lib := library(t)
	upstream := fakeFeed(t)
	hub, err := feed.NewHub(upstream.URL, testLog{t})
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	manager := stream.NewManager(ctx, hub, stream.Voices{Library: lib}, testLog{t}, stream.Options{
		BitrateKbps: 64, SegmentDuration: time.Second, Window: 6, IdleTimeout: 30 * time.Second, MaxStreams: 2,
	})
	server := httptest.NewServer(New(manager, lib, nil, []string{"*"}, testLog{t}).Handler())
	defer server.Close()

	playlistURL := server.URL + "/v1/streams/live.m3u8?crs=KGX&chime=none"
	heard := map[string][]byte{}
	var order []string
	deadline := time.Now().Add(40 * time.Second)
	for time.Now().Before(deadline) && len(order) < 14 {
		response, err := http.Get(playlistURL)
		if err != nil {
			t.Fatal(err)
		}
		body, _ := io.ReadAll(response.Body)
		response.Body.Close()
		if response.StatusCode != http.StatusOK {
			t.Fatalf("playlist: HTTP %d: %s", response.StatusCode, body)
		}
		if got := response.Header.Get("Content-Type"); got != "application/vnd.apple.mpegurl" {
			t.Fatalf("playlist content type %q", got)
		}
		if response.Header.Get("Access-Control-Allow-Origin") != "*" {
			t.Fatal("the playlist cannot be read from another origin")
		}
		for _, line := range strings.Split(string(body), "\n") {
			if line == "" || strings.HasPrefix(line, "#") || heard[line] != nil {
				continue
			}
			if !strings.HasSuffix(line, ".aac?crs=KGX") {
				t.Fatalf("segment %q does not carry its station for the load balancer", line)
			}
			segment, err := http.Get(server.URL + "/v1/streams/" + line)
			if err != nil {
				t.Fatal(err)
			}
			data, _ := io.ReadAll(segment.Body)
			segment.Body.Close()
			if segment.StatusCode != http.StatusOK || !bytes.HasPrefix(data, []byte("ID3")) {
				t.Fatalf("segment %s: HTTP %d, starts % x", line, segment.StatusCode, data[:min(4, len(data))])
			}
			heard[line] = data
			order = append(order, line)
		}
		time.Sleep(500 * time.Millisecond)
	}
	if len(order) < 14 {
		t.Fatalf("only %d segments in 40 seconds", len(order))
	}

	var joined bytes.Buffer
	for _, name := range order {
		joined.Write(heard[name])
	}
	pcm := decode(t, "aac", joined.Bytes())
	loudest, loudSeconds := 0, 0.0
	for i := 0; i+1 < len(pcm); i += 2 {
		sample := int(int16(binary.LittleEndian.Uint16(pcm[i:])))
		if sample < 0 {
			sample = -sample
		}
		loudest = max(loudest, sample)
		if sample > 1000 {
			loudSeconds += 1.0 / audio.SampleRate
		}
	}
	t.Logf("%d segments, %.1fs decoded, peak %d, %.1fs above the noise floor", len(order), float64(len(pcm))/2/audio.SampleRate, loudest, loudSeconds)
	if loudest < 5000 || loudSeconds < 1 {
		t.Error("the stream carried no speech")
	}
}

func TestTheStreamAlsoComesAsOneEndlessResponse(t *testing.T) {
	lib := library(t)
	hub, _ := feed.NewHub("http://127.0.0.1:1", testLog{t})
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	manager := stream.NewManager(ctx, hub, stream.Voices{Library: lib}, testLog{t}, stream.Options{
		BitrateKbps: 64, SegmentDuration: time.Second, Window: 6, IdleTimeout: 30 * time.Second, MaxStreams: 2,
	})
	server := httptest.NewServer(New(manager, lib, nil, []string{"*"}, testLog{t}).Handler())
	defer server.Close()

	request, _ := http.NewRequestWithContext(ctx, http.MethodGet, server.URL+"/v1/streams/live.mp3?crs=KGX&zone=1,2&zone=3", nil)
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK || response.Header.Get("Content-Type") != "audio/mpeg" {
		t.Fatalf("HTTP %d %s", response.StatusCode, response.Header.Get("Content-Type"))
	}
	// Three seconds at 64 kbit/s, silence included, which has to arrive while the
	// response is still open.
	received := make([]byte, 24_000)
	started := time.Now()
	if _, err := io.ReadFull(response.Body, received); err != nil {
		t.Fatal(err)
	}
	if received[0] != 0xFF || received[1]&0xFE != 0xFA {
		t.Errorf("the response does not start on an MP3 frame: % x", received[:4])
	}
	if took := time.Since(started); took > 15*time.Second {
		t.Errorf("three seconds of audio took %s", took)
	}
	if pcm := decode(t, "mp3", received); len(pcm) < 2*audio.SampleRate {
		t.Errorf("only %d bytes decoded", len(pcm))
	}
}

// A listener who is connected is listening. The response has to say so more
// often than the idle timeout runs out, or the stream stops under its listener.
func TestAConnectedListenerKeepsItsStream(t *testing.T) {
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		t.Skip("ffmpeg is not installed")
	}
	hub, _ := feed.NewHub("http://127.0.0.1:1", testLog{t})
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	// Half the shortest idle timeout that the configuration accepts. At the
	// shortest itself, a response that speaks up every ten seconds survives or
	// not by which of two timers fires first, and a test would pass by luck.
	const idle = 5 * time.Second
	manager := stream.NewManager(ctx, hub, nil, testLog{t}, stream.Options{
		BitrateKbps: 64, SegmentDuration: time.Second, Window: 6, IdleTimeout: idle, MaxStreams: 1,
	})
	server := httptest.NewServer(New(manager, nil, nil, []string{"*"}, testLog{t}).Handler())
	defer server.Close()

	request, _ := http.NewRequestWithContext(ctx, http.MethodGet, server.URL+"/v1/streams/live.mp3?crs=KGX", nil)
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	// The response arrives as fast as it is played, at 8,000 bytes a second, so
	// this much of it outlasts the idle timeout.
	outlasting := make([]byte, int((idle+3*time.Second).Seconds())*8000)
	if n, err := io.ReadFull(response.Body, outlasting); err != nil {
		t.Fatalf("the stream stopped under its listener after %.1f seconds of audio: %v", float64(n)/8000, err)
	}
}

// A player that has fallen behind asks for silence to be left out of its own
// response, and catches up without a new connection.
func TestALateListenerIsSparedSilence(t *testing.T) {
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		t.Skip("ffmpeg is not installed")
	}
	hub, _ := feed.NewHub("http://127.0.0.1:1", testLog{t})
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	manager := stream.NewManager(ctx, hub, nil, testLog{t}, stream.Options{
		BitrateKbps: 64, SegmentDuration: time.Second, Window: 6, IdleTimeout: 30 * time.Second, MaxStreams: 2,
	})
	server := httptest.NewServer(New(manager, nil, nil, []string{"*"}, testLog{t}).Handler())
	defer server.Close()

	trim := func(query string) (status int, trimmed, pending float64) {
		t.Helper()
		response, err := http.Post(server.URL+"/v1/streams/trim?"+query, "", nil)
		if err != nil {
			t.Fatal(err)
		}
		defer response.Body.Close()
		var body struct{ Trimmed, Pending float64 }
		json.NewDecoder(response.Body).Decode(&body)
		return response.StatusCode, body.Trimmed, body.Pending
	}

	// Asking about a stream that isn't playing must not start it.
	if status, _, _ := trim("crs=KGX&listener=late-listener&total=2"); status != http.StatusNotFound || manager.Count() != 0 {
		t.Errorf("a stream that isn't playing: HTTP %d and %d streams, want 404 and none", status, manager.Count())
	}
	if response, _ := http.Get(server.URL + "/v1/streams/live.mp3?crs=KGX&listener=no"); response.StatusCode != http.StatusBadRequest {
		t.Errorf("a listener name too short to be a secret: HTTP %d", response.StatusCode)
	}

	request, _ := http.NewRequestWithContext(ctx, http.MethodGet, server.URL+"/v1/streams/live.mp3?crs=KGX&listener=late-listener", nil)
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	started := time.Now()

	for query, want := range map[string]int{
		"crs=KGX&listener=someone-else&total=2":   http.StatusNotFound,
		"crs=KGX&listener=late-listener&total=x":  http.StatusBadRequest,
		"crs=KGX&listener=late-listener&total=-1": http.StatusBadRequest,
		"listener=late-listener&total=2":          http.StatusBadRequest,
	} {
		if status, _, _ := trim(query); status != want {
			t.Errorf("%s: HTTP %d, want %d", query, status, want)
		}
	}
	if status, trimmed, pending := trim("crs=KGX&listener=late-listener&total=2"); status != http.StatusOK || trimmed != 0 || pending < 1.9 || pending > 2 {
		t.Fatalf("HTTP %d, %.2f seconds left out and %.2f to come, want 200, none and two", status, trimmed, pending)
	}

	// The station is silent, and the response arrives as fast as it is played, at
	// 8,000 bytes a second. Its first two seconds could be a pause inside an
	// announcement, and the two after those are left out.
	const listenFor = 7 * time.Second
	received := 0
	buffer := make([]byte, 8<<10)
	for time.Since(started) < listenFor {
		n, err := response.Body.Read(buffer)
		received += n
		if err != nil {
			t.Fatalf("the response ended after %d bytes: %v", received, err)
		}
	}
	if seconds := float64(received) / 8000; seconds < listenFor.Seconds()-3 || seconds > listenFor.Seconds()-1.5 {
		t.Errorf("%.1f seconds of audio arrived in %s, want two seconds fewer", seconds, listenFor)
	}
	// Asking for the same total again adds nothing to it.
	if status, trimmed, pending := trim("crs=KGX&listener=late-listener&total=2"); status != http.StatusOK || trimmed < 1.9 || trimmed > 2 || pending != 0 {
		t.Errorf("HTTP %d, %.2f seconds left out and %.2f to come, want 200, two and none", status, trimmed, pending)
	}
}

// TestTheListenersCushionSurvivesAColdFirstAnnouncement holds the mixer to
// real time. The response arrives at the rate it is played, so audio the
// service fails to send is taken out of the three seconds a player holds and
// is never given back: Firefox then waits about fifteen seconds to rebuffer,
// which costs the listener most of an announcement. The first announcement on
// a cold stream is where that happens, because it decodes dozens of clips.
func TestTheListenersCushionSurvivesAColdFirstAnnouncement(t *testing.T) {
	lib := library(t)
	upstream := fakeFeed(t)
	hub, err := feed.NewHub(upstream.URL, testLog{t})
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	manager := stream.NewManager(ctx, hub, stream.Voices{Library: lib}, testLog{t}, stream.Options{
		BitrateKbps: 64, SegmentDuration: time.Second, Window: 6, IdleTimeout: 30 * time.Second, MaxStreams: 2,
	})
	server := httptest.NewServer(New(manager, lib, nil, []string{"*"}, testLog{t}).Handler())
	defer server.Close()

	request, _ := http.NewRequestWithContext(ctx, http.MethodGet, server.URL+"/v1/streams/live.mp3?crs=KGX&chime=none", nil)
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		t.Fatalf("HTTP %d", response.StatusCode)
	}

	// 64 kbit/s constant, so the bytes received are the audio delivered. The
	// first listener of a cold stream gets no lead-in, so the clock starts at
	// the first byte, and the allowance covers the encoder starting up.
	const bytesPerSecond, allowed = 8000.0, 0.75
	// A read takes whatever has arrived, so a buffer wide enough for a catch-up
	// burst keeps the audio that makes up for a late tick from being measured a
	// fragment at a time, which would read as the shortfall it repairs.
	buffer := make([]byte, 32<<10)
	var heard bytes.Buffer
	var started time.Time
	worst, report := 0.0, time.Second
	for {
		n, err := response.Body.Read(buffer)
		if started.IsZero() {
			started = time.Now()
		}
		heard.Write(buffer[:n])
		if err != nil {
			t.Fatalf("the response ended after %d bytes: %v", heard.Len(), err)
		}
		elapsed, received := time.Since(started), float64(heard.Len())/bytesPerSecond
		worst = max(worst, elapsed.Seconds()-received)
		if elapsed >= report {
			t.Logf("t=%4.1fs  audio received=%5.2fs  behind by %+.2fs", elapsed.Seconds(), received, elapsed.Seconds()-received)
			report += time.Second
		}
		if elapsed >= 10*time.Second {
			break
		}
	}
	if worst > allowed {
		t.Errorf("the audio fell %.2fs behind the clock, which is more than the %.2fs a player can lose: the mixer dropped audio or the encoder was starved", worst, allowed)
	}

	// A station that said nothing would keep pace whatever the mixer did, so
	// the measurement counts only if the announcement played.
	pcm := decode(t, "mp3", heard.Bytes())
	loudest := 0
	for i := 0; i+1 < len(pcm); i += 2 {
		sample := int(int16(binary.LittleEndian.Uint16(pcm[i:])))
		loudest = max(loudest, sample, -sample)
	}
	if loudest < 5000 {
		t.Errorf("the stream carried no announcement (peak %d), so nothing was measured through a cold render", loudest)
	}
}

func decode(t *testing.T, format string, aac []byte) []byte {
	t.Helper()
	cmd := exec.Command("ffmpeg", "-v", "error", "-f", format, "-i", "-", "-f", "s16le", "-ac", "1", "-ar", fmt.Sprint(audio.SampleRate), "-")
	cmd.Stdin = bytes.NewReader(aac)
	var problems bytes.Buffer
	cmd.Stderr = &problems
	out, err := cmd.Output()
	if err != nil {
		t.Fatalf("ffmpeg could not decode the stream: %v: %s", err, problems.String())
	}
	return out
}

func post(t *testing.T, url string, body any) (*http.Response, []byte) {
	t.Helper()
	encoded, _ := json.Marshal(body)
	response, err := http.Post(url+"/v1/announcements", "application/json", bytes.NewReader(encoded))
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	data, _ := io.ReadAll(response.Body)
	return response, data
}

func TestAPostedStateComesBackAsAnMP3OrAJSONError(t *testing.T) {
	lib := library(t)
	hub, _ := feed.NewHub("http://127.0.0.1:1", testLog{t})
	manager := stream.NewManager(context.Background(), hub, stream.Voices{Library: lib}, testLog{t}, stream.Options{MaxStreams: 1})
	server := httptest.NewServer(New(manager, lib, nil, []string{"https://railannouncements.co.uk"}, testLog{t}).Handler())
	defer server.Close()

	file, err := os.Open("../ketech/testdata/parity-state.json.gz")
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()
	unzipped, _ := gzip.NewReader(file)
	var states []struct {
		Voice        string          `json:"voice"`
		Announcement string          `json:"announcement"`
		State        json.RawMessage `json:"state"`
	}
	if err := json.NewDecoder(unzipped).Decode(&states); err != nil {
		t.Fatal(err)
	}
	state := states[0]

	request := map[string]any{"system": "AMEY_PHIL_V1", "announcement": state.Announcement, "state": state.State}
	response, body := post(t, server.URL, request)
	if response.StatusCode != http.StatusOK || response.Header.Get("Content-Type") != "audio/mpeg" {
		t.Fatalf("HTTP %d %s: %s", response.StatusCode, response.Header.Get("Content-Type"), body[:min(200, len(body))])
	}
	if !bytes.HasPrefix(body, []byte("ID3")) && (len(body) < 2 || body[0] != 0xFF) {
		t.Errorf("the body is not an MP3: % x", body[:8])
	}
	if len(body) < 50_000 {
		t.Errorf("the MP3 is only %d bytes", len(body))
	}

	var broken map[string]any
	json.Unmarshal(state.State, &broken)
	broken["terminatingStationCode"] = "ZZZ"
	for name, c := range map[string]struct {
		body   any
		status int
		code   string
	}{
		"unknown system":       {map[string]any{"system": "NOPE", "announcement": "nextTrain", "state": broken}, 404, "unknown_system"},
		"unknown announcement": {map[string]any{"system": "AMEY_PHIL_V1", "announcement": "nope", "state": broken}, 404, "unknown_announcement"},
		"missing audio":        {map[string]any{"system": "AMEY_PHIL_V1", "announcement": state.Announcement, "state": broken}, 422, "missing_audio"},
		"bad state":            {map[string]any{"system": "AMEY_PHIL_V1", "announcement": "nextTrain", "state": "text"}, 422, "invalid_state"},
		"not json":             {"{", 400, "bad_request"},
	} {
		response, body := post(t, server.URL, c.body)
		var parsed struct {
			Error struct{ Code, Message string } `json:"error"`
		}
		json.Unmarshal(body, &parsed)
		if response.StatusCode != c.status || parsed.Error.Code != c.code || parsed.Error.Message == "" || response.Header.Get("Content-Type") != "application/json" {
			t.Errorf("%s: HTTP %d %s", name, response.StatusCode, body)
		}
	}

	preflight, _ := http.NewRequest(http.MethodOptions, server.URL+"/v1/announcements", nil)
	preflight.Header.Set("Origin", "https://railannouncements.co.uk")
	allowed, err := http.DefaultClient.Do(preflight)
	if err != nil {
		t.Fatal(err)
	}
	if allowed.StatusCode != http.StatusNoContent || allowed.Header.Get("Access-Control-Allow-Origin") != "https://railannouncements.co.uk" {
		t.Errorf("preflight: HTTP %d, allow-origin %q", allowed.StatusCode, allowed.Header.Get("Access-Control-Allow-Origin"))
	}
	preflight.Header.Set("Origin", "https://example.com")
	if refused, _ := http.DefaultClient.Do(preflight); refused.Header.Get("Access-Control-Allow-Origin") != "" {
		t.Error("an origin that is not listed was allowed")
	}
}

func TestBadZonesAreRefused(t *testing.T) {
	hub, _ := feed.NewHub("http://127.0.0.1:1", testLog{t})
	manager := stream.NewManager(context.Background(), hub, nil, testLog{t}, stream.Options{MaxStreams: 1})
	server := httptest.NewServer(New(manager, nil, nil, []string{"*"}, testLog{t}).Handler())
	defer server.Close()
	for _, query := range []string{"", "?crs=KGX&voice=anne", "?crs=KGX&type=arriving"} {
		response, err := http.Get(server.URL + "/v1/streams/live.m3u8" + query)
		if err != nil {
			t.Fatal(err)
		}
		if response.StatusCode != http.StatusBadRequest {
			t.Errorf("%q: HTTP %d", query, response.StatusCode)
		}
	}
	if response, _ := http.Get(server.URL + "/v1/streams/nope/1.aac"); response.StatusCode != http.StatusNotFound {
		t.Errorf("unknown segment: HTTP %d", response.StatusCode)
	}
}

func TestAHelpPointSpeaksTheDepartureBoard(t *testing.T) {
	lib := library(t)
	darwinBrowser := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Query().Get("crs") {
		case "KGX":
			io.WriteString(w, `{"services": [{"toc": "GR", "planned_dep": "2026-07-14T09:00:00+01:00", "platform": "4",
				"exp_dep": {"t": "09:12:00"}, "late_reason_code": "100", "coach_count": 9,
				"destinations": [{"crs": "EDB", "via": {"locs": ["YRK"]}}]}]}`)
		case "ZZZ":
			http.Error(w, "no such station", http.StatusNotFound)
		default:
			http.Error(w, "the database is away", http.StatusBadGateway)
		}
	}))
	defer darwinBrowser.Close()
	board, err := helppoint.NewBoard(darwinBrowser.URL)
	if err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(New(nil, lib, board, []string{"*"}, testLog{t}).Handler())
	defer server.Close()

	seconds := func(path string) float64 {
		t.Helper()
		response, err := http.Get(server.URL + "/v1/help-points/" + path)
		if err != nil {
			t.Fatal(err)
		}
		defer response.Body.Close()
		body, _ := io.ReadAll(response.Body)
		if response.StatusCode != http.StatusOK || response.Header.Get("Content-Type") != "audio/mpeg" {
			t.Fatalf("%s: status %d, %s: %s", path, response.StatusCode, response.Header.Get("Content-Type"), body)
		}
		decode := exec.Command("ffmpeg", "-v", "error", "-i", "-", "-f", "s16le", "-ac", "1", "-ar", "44100", "-")
		decode.Stdin = bytes.NewReader(body)
		pcm, err := decode.Output()
		if err != nil {
			t.Fatalf("%s: the response isn't an MP3: %v", path, err)
		}
		return float64(len(pcm)) / 2 / 44100
	}

	spoken, unavailable := seconds("kgx"), seconds("CBG")
	if celia := seconds("KGX?voice=celia"); celia < 20 {
		t.Errorf("Celia's board lasts %.1f seconds, which is too short to hold a delayed service", celia)
	}
	if spoken < 20 {
		t.Errorf("the board lasts %.1f seconds, which is too short to hold a delayed service", spoken)
	}
	// The apology is four sentences with two one-second pauses.
	if unavailable < 6 || unavailable > 15 {
		t.Errorf("a help point with no board spoke for %.1f seconds, want the apology", unavailable)
	}

	for path, want := range map[string]struct {
		status int
		code   string
	}{
		"/v1/help-points/ZZZ":              {http.StatusNotFound, "unknown_station"},
		"/v1/help-points/KGXX":             {http.StatusBadRequest, "bad_crs"},
		"/v1/help-points/K.X":              {http.StatusBadRequest, "bad_crs"},
		"/v1/help-points/KGX?voice=nobody": {http.StatusBadRequest, "bad_voice"},
	} {
		response, err := http.Get(server.URL + path)
		if err != nil {
			t.Fatal(err)
		}
		var body struct{ Error apiError }
		json.NewDecoder(response.Body).Decode(&body)
		response.Body.Close()
		if response.StatusCode != want.status || body.Error.Code != want.code {
			t.Errorf("%s: status %d, code %q, want %d, %q", path, response.StatusCode, body.Error.Code, want.status, want.code)
		}
	}
}
