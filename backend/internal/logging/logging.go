// Package logging is the service's logger: logrus, with methods that take the
// error first so that it can't be left out of an error log.
package logging

import "github.com/sirupsen/logrus"

type Logger struct {
	entry *logrus.Entry
}

// New returns a logger that writes to standard error. Debug logs are dropped
// unless includeDebug is set.
func New(includeDebug bool) *Logger {
	base := logrus.New()
	base.SetFormatter(&logrus.TextFormatter{FullTimestamp: true})
	if includeDebug {
		base.SetLevel(logrus.DebugLevel)
	}
	return &Logger{logrus.NewEntry(base)}
}

func (l *Logger) Debugf(format string, args ...any) { l.entry.Debugf(format, args...) }
func (l *Logger) Infof(format string, args ...any)  { l.entry.Infof(format, args...) }
func (l *Logger) Warnf(format string, args ...any)  { l.entry.Warnf(format, args...) }

func (l *Logger) WarnE(prefix string, err error)  { l.entry.WithError(err).Warn(prefix) }
func (l *Logger) ErrorE(prefix string, err error) { l.entry.WithError(err).Error(prefix) }

// FatalE logs and then exits the process.
func (l *Logger) FatalE(prefix string, err error) { l.entry.WithError(err).Fatal(prefix) }

func (l *Logger) WithField(key string, value any) *Logger {
	return &Logger{l.entry.WithField(key, value)}
}
