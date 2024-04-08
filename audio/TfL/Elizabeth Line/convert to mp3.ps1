Get-ChildItem -Recurse -Filter *.wav | ForEach-Object -Parallel {
  ffmpeg -i $_.FullName $_.FullName.Replace(".wav", ".mp3")
  Remove-Item $_.FullName
} -ThrottleLimit 10
