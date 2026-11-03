package feed

import (
	"fmt"

	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/timestamppb"

	"rail-announcements-backend/internal/feed/livepb"
)

// ProtocolVersion is the only version of Darwin Browser's station streams this
// service reads. The streams do not negotiate, so any other value is fatal.
const ProtocolVersion = 2

var announcementTypes = map[livepb.AnnouncementType]AnnouncementType{
	livepb.AnnouncementType_ANNOUNCEMENT_TYPE_NEXT:                Next,
	livepb.AnnouncementType_ANNOUNCEMENT_TYPE_APPROACHING:         Approaching,
	livepb.AnnouncementType_ANNOUNCEMENT_TYPE_STANDING:            Standing,
	livepb.AnnouncementType_ANNOUNCEMENT_TYPE_DISRUPTED:           Disrupted,
	livepb.AnnouncementType_ANNOUNCEMENT_TYPE_PASSING:             Passing,
	livepb.AnnouncementType_ANNOUNCEMENT_TYPE_PLATFORM_ALTERATION: PlatformAlteration,
}

var transportModes = map[livepb.TransportMode]string{
	livepb.TransportMode_TRANSPORT_MODE_TRAIN: "train",
	livepb.TransportMode_TRANSPORT_MODE_BUS:   "bus",
	livepb.TransportMode_TRANSPORT_MODE_FERRY: "ferry",
}

var movementKinds = map[livepb.MovementKind]string{
	livepb.MovementKind_MOVEMENT_KIND_STOP:      "stop",
	livepb.MovementKind_MOVEMENT_KIND_ARRIVAL:   "arrival",
	livepb.MovementKind_MOVEMENT_KIND_DEPARTURE: "departure",
	livepb.MovementKind_MOVEMENT_KIND_PASSING:   "passing",
	livepb.MovementKind_MOVEMENT_KIND_UNKNOWN:   "unknown",
}

// Decode reads one frame of the announcement stream. It returns a *Ready,
// *Announcement, *Retraction, *Revision or *Heartbeat. A payload or an
// announcement type this build does not know decodes to nil: the stream may
// grow, and an unknown message still proves the connection is alive.
func Decode(frame []byte) (any, error) {
	var message livepb.ServerMessage
	if err := proto.Unmarshal(frame, &message); err != nil {
		return nil, fmt.Errorf("decode stream message: %w", err)
	}
	if message.GetVersion() != ProtocolVersion {
		return nil, fmt.Errorf("unsupported stream version %d", message.GetVersion())
	}
	switch payload := message.GetPayload().(type) {
	case *livepb.ServerMessage_Heartbeat:
		return &Heartbeat{}, nil
	case *livepb.ServerMessage_Ready:
		return &Ready{Station: location(payload.Ready.GetStation()), Healthy: payload.Ready.GetHealthy()}, nil
	case *livepb.ServerMessage_Announcement:
		a := payload.Announcement
		kind, ok := announcementTypes[a.GetAnnouncementType()]
		if !ok {
			return nil, nil
		}
		platforms := a.GetAffectedPlatforms()
		if platforms == nil {
			platforms = []string{}
		}
		return &Announcement{
			EventID:           a.GetEventId(),
			MovementID:        a.GetMovementId(),
			Station:           location(a.GetStation()),
			Type:              kind,
			CreatedAt:         instant(a.GetCreatedAt()),
			ExpiresAt:         instant(a.GetExpiresAt()),
			Details:           movement(a.GetDetails()),
			AffectedPlatforms: platforms,
			PreviousPlatform:  a.PreviousPlatform,
			NewPlatform:       a.NewPlatform,
		}, nil
	case *livepb.ServerMessage_Retraction:
		return &Retraction{EventID: payload.Retraction.GetEventId(), Reason: payload.Retraction.GetReason()}, nil
	case *livepb.ServerMessage_Revision:
		r := payload.Revision
		return &Revision{EventID: r.GetEventId(), MovementID: r.GetMovementId(), Details: movement(r.GetDetails())}, nil
	}
	return nil, nil
}

func instant(t *timestamppb.Timestamp) Instant {
	if t == nil {
		return Instant{}
	}
	return At(t.AsTime())
}

func location(l *livepb.Location) Location {
	if l == nil {
		return Location{}
	}
	return Location{TPL: l.GetTpl(), CRS: l.Crs, Name: l.Name}
}

func optionalLocation(l *livepb.Location) *Location {
	if l == nil {
		return nil
	}
	out := location(l)
	return &out
}

func times(t *livepb.Times) Times {
	return Times{Planned: instant(t.GetPlanned()), Estimated: instant(t.GetEstimated()), Actual: instant(t.GetActual()), UnknownDelay: t.GetUnknownDelay()}
}

func platform(p *livepb.Platform) Platform {
	if p == nil {
		return Platform{}
	}
	return Platform{Number: p.Number, Confirmed: p.Confirmed, Suppressed: p.Suppressed, Source: p.Source}
}

func reason(r *livepb.Reason) Reason {
	if r == nil {
		return Reason{}
	}
	return Reason{Code: r.Code, Text: r.Text}
}

func count(n *int32) *int {
	if n == nil {
		return nil
	}
	out := int(*n)
	return &out
}

func endpoints(in []*livepb.Endpoint) []Endpoint {
	out := make([]Endpoint, len(in))
	for i, e := range in {
		out[i] = Endpoint{Location: location(e.GetLocation()), AssocRID: e.AssocRid, AssocCat: e.AssocCat}
		if via := e.GetVia(); via != nil {
			out[i].Via = &Via{Text: via.GetText(), Locs: via.GetLocs()}
		}
	}
	return out
}

func calls(in []*livepb.Call) []Call {
	out := make([]Call, len(in))
	for i, c := range in {
		out[i] = Call{
			Location:         location(c.GetLocation()),
			ID:               c.GetId(),
			Arrival:          times(c.GetArrival()),
			Departure:        times(c.GetDeparture()),
			Platform:         platform(c.GetPlatform()),
			Cancelled:        c.GetCancelled(),
			Activities:       c.Activities,
			Operational:      c.GetOperational(),
			DetachFront:      c.DetachFront,
			FalseDestination: optionalLocation(c.GetFalseDestination()),
			CoachCount:       count(c.CoachCount),
			FormationChange:  formationChange(c.GetFormationChange()),
		}
	}
	return out
}

func formationChange(c *livepb.FormationChange) *FormationChange {
	if c == nil {
		return nil
	}
	part := func(p *livepb.FormationPart) *FormationPart {
		if p == nil {
			return nil
		}
		return &FormationPart{Coaches: count(p.Coaches), Position: p.Position}
	}
	return &FormationChange{Detached: part(c.GetDetached()), Attached: part(c.GetAttached())}
}

func portions(in []*livepb.Portion) []Portion {
	out := make([]Portion, len(in))
	for i, p := range in {
		out[i] = Portion{
			Headcode:     p.Headcode,
			OperatorCode: p.OperatorCode,
			OperatorName: p.OperatorName,
			Origin:       optionalLocation(p.GetOrigin()),
			Destination:  optionalLocation(p.GetDestination()),
			RID:          p.GetRid(),
			Category:     p.GetCategory(),
			At:           location(p.GetAt()),
			Cancelled:    p.GetCancelled(),
			Available:    p.GetAvailable(),
			CoachCount:   count(p.CoachCount),
			Position:     p.Position,
			Calls:        calls(p.GetCalls()),
			Main:         p.Main,
			Links:        portions(p.GetLinks()),
		}
		if mode, ok := transportModes[p.GetMode()]; ok {
			out[i].Mode = &mode
		}
	}
	return out
}

func movement(m *livepb.Movement) Movement {
	out := Movement{
		ID:               m.GetId(),
		RID:              m.GetRid(),
		Station:          location(m.GetStation()),
		Kind:             movementKinds[m.GetKind()],
		Mode:             transportModes[m.GetMode()],
		UID:              m.Uid,
		Headcode:         m.Headcode,
		OperatorCode:     m.OperatorCode,
		OperatorName:     m.OperatorName,
		Arrival:          times(m.GetArrival()),
		Departure:        times(m.GetDeparture()),
		Passing:          times(m.GetPassing()),
		Platform:         platform(m.GetPlatform()),
		Cancelled:        m.GetCancelled(),
		CancelReason:     reason(m.GetCancelReason()),
		DelayReason:      reason(m.GetDelayReason()),
		CoachCount:       count(m.CoachCount),
		LoadingPercent:   count(m.LoadingPercent),
		ReverseFormation: m.ReverseFormation,
		FalseDestination: optionalLocation(m.GetFalseDestination()),
		Origins:          endpoints(m.GetOrigins()),
		Destinations:     endpoints(m.GetDestinations()),
		CallingPoints:    calls(m.GetCallingPoints()),
		Portions:         portions(m.GetPortions()),
	}
	if list := m.GetCoaches(); list != nil {
		out.Coaches = make([]Coach, len(list.GetCoaches()))
		for i, coach := range list.GetCoaches() {
			out.Coaches[i] = Coach{Number: coach.GetNumber(), LoadingPercent: count(coach.LoadingPercent)}
		}
	}
	return out
}
