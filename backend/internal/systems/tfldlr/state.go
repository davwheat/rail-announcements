package tfldlr

import "encoding/json"

// jsString is a state field the handlers look up in a table. It keeps the raw
// JSON so that a refusal message can name the field the way a JavaScript
// template literal would: an absent field is "undefined" and an explicit null
// is "null".
type jsString struct {
	raw json.RawMessage
}

func (v *jsString) UnmarshalJSON(raw []byte) error {
	v.raw = append(v.raw[:0], raw...)
	return nil
}

// Value is the name to look up. Anything that is not a JSON string matches no
// station or destination, as undefined does in the TypeScript.
func (v jsString) Value() string {
	var name string
	if json.Unmarshal(v.raw, &name) != nil {
		return ""
	}
	return name
}

func (v jsString) String() string {
	switch {
	case len(v.raw) == 0:
		return "undefined"
	case string(v.raw) == "null":
		return "null"
	}
	var name string
	if json.Unmarshal(v.raw, &name) != nil {
		return string(v.raw)
	}
	return name
}

// jsBool is a state field the handlers only test for truth, which the option
// UI writes as a boolean but a hand-edited or older preset may not.
type jsBool struct {
	raw json.RawMessage
}

func (v *jsBool) UnmarshalJSON(raw []byte) error {
	v.raw = append(v.raw[:0], raw...)
	return nil
}

// Truthy applies JavaScript's rules: only false, null, undefined, 0 and the
// empty string are falsy.
func (v jsBool) Truthy() bool {
	var decoded any
	if len(v.raw) == 0 || json.Unmarshal(v.raw, &decoded) != nil {
		return false
	}
	switch value := decoded.(type) {
	case nil:
		return false
	case bool:
		return value
	case float64:
		return value != 0
	case string:
		return value != ""
	}
	return true
}
