package snclass377

import (
	"encoding/json"
	"math"
	"strconv"
	"strings"
)

// jsText is a state field the website interpolates into a clip ID. A template
// literal names whatever it is handed, so a number, a null or a field the
// state never set has to reach the audio as its own text rather than fail.
// Comparisons keep their meaning too: the handlers only ever test a field
// against a string literal, which no rendering of another type can match.
type jsText struct {
	value string
	set   bool
}

func (t *jsText) UnmarshalJSON(raw []byte) error {
	var value any
	if err := json.Unmarshal(raw, &value); err != nil {
		return err
	}
	t.value, t.set = jsString(value), true
	return nil
}

// String is `${value}`, and "undefined" for a field the state omits.
func (t jsText) String() string {
	if !t.set {
		return "undefined"
	}
	return t.value
}

func jsString(value any) string {
	switch value := value.(type) {
	case nil:
		return "null"
	case bool:
		return strconv.FormatBool(value)
	case string:
		return value
	case float64:
		// JSON numbers arrive as float64, and JavaScript prints a whole one
		// without a fractional part.
		if math.IsNaN(value) {
			return "NaN"
		}
		if math.IsInf(value, 0) {
			return "Infinity"
		}
		return strconv.FormatFloat(value, 'f', -1, 64)
	case []any:
		parts := make([]string, len(value))
		for i, item := range value {
			if item == nil {
				continue
			}
			parts[i] = jsString(item)
		}
		return strings.Join(parts, ",")
	default:
		return "[object Object]"
	}
}

// jsBool is a state field the handlers test for truth rather than compare, so
// the website's own truthiness decides it: "false", 0 and "" are as false as
// false itself, and an absent field is false.
type jsBool struct {
	truthy bool
}

func (b *jsBool) UnmarshalJSON(raw []byte) error {
	var value any
	if err := json.Unmarshal(raw, &value); err != nil {
		return err
	}
	switch value := value.(type) {
	case nil:
		b.truthy = false
	case bool:
		b.truthy = value
	case string:
		b.truthy = value != ""
	case float64:
		b.truthy = value != 0 && !math.IsNaN(value)
	default:
		b.truthy = true
	}
	return nil
}
