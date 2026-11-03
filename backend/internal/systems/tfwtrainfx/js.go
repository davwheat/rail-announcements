package tfwtrainfx

import (
	"encoding/json"
	"strconv"
)

// state is a tab's option object, held as the website posts it. Its fields are
// read one at a time so that a missing, null or oddly typed value reaches the
// announcement the way JavaScript would hand it over.
type state map[string]json.RawMessage

// text renders a field as a JavaScript template literal would splice it in, so
// a field that is absent reads "undefined" and one that is null reads "null".
func text(raw json.RawMessage) string {
	if len(raw) == 0 {
		return "undefined"
	}
	var value any
	if err := json.Unmarshal(raw, &value); err != nil {
		return string(raw)
	}
	switch value := value.(type) {
	case nil:
		return "null"
	case string:
		return value
	case bool:
		return strconv.FormatBool(value)
	case float64:
		return strconv.FormatFloat(value, 'f', -1, 64)
	}
	return string(raw)
}

// truthy tests a field the way an `if` in JavaScript would.
func truthy(raw json.RawMessage) bool {
	if len(raw) == 0 {
		return false
	}
	var value any
	if err := json.Unmarshal(raw, &value); err != nil {
		return false
	}
	switch value := value.(type) {
	case nil:
		return false
	case string:
		return value != ""
	case bool:
		return value
	case float64:
		return value != 0
	}
	return true
}
