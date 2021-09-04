import AnnouncementSystem from './AnnouncementSystem'

export default abstract class StationAnnouncementSystem extends AnnouncementSystem {
  /**
   * Shows an alert to the user.
   */
  protected showAudioNotExistsError(fileName: string): void {
    console.error(`No audio file could be found for \`${fileName}\`!`)
    alert(
      `Unfortunately, we don't have the audio needed for this (${fileName}). If you can record this, please do so, then create an issue or PR on GitHub!`,
    )
  }
}
