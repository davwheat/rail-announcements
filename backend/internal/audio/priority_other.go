//go:build !unix

package audio

import "os/exec"

// deprioritize does nothing where there is no scheduling priority to set. The
// service runs on Linux, and a decode at normal priority is what every other
// platform had before.
func deprioritize(*exec.Cmd) {}
