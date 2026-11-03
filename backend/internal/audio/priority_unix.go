//go:build unix

package audio

import (
	"os/exec"
	"syscall"
)

// decodeNice is how far behind everything else a decode runs.
const decodeNice = 10

// deprioritize asks the kernel to schedule a decode behind the stream
// encoders. An encoder that misses its turn on the CPU costs a listener the
// audio it should have been sent, which never arrives later; a decode that
// waits only starts an announcement a moment later. A kernel that refuses is
// no reason to fail the decode.
func deprioritize(cmd *exec.Cmd) {
	if cmd.Process == nil {
		return
	}
	_ = syscall.Setpriority(syscall.PRIO_PROCESS, cmd.Process.Pid, decodeNice)
}
