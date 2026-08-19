import ThameslinkClass700 from './systems/rolling-stock/TLClass700'
import BombardierXstar from './systems/rolling-stock/BombardierXstar'
import TfWTrainFx from './systems/rolling-stock/TfWTrainFx'
import TfWTelevic from './systems/rolling-stock/TfWTelevic'

import AmeyPhil from './systems/stations/AmeyPhil'
import AmeyCelia from './systems/stations/AmeyCelia'
// import AtosMatt from './systems/stations/AtosMatt'
// import AtosAnne from './systems/stations/AtosAnne'
import ScotRail from './systems/stations/ScotRail'

import Banedanmark from './systems/international/denmark/Banedanmark'

import TfLJubileeLine from './systems/rolling-stock/TfLJubileeLine'
import TfLNorthernLine from './systems/rolling-stock/TfLNorthernLine'
import TfLElizabethLine from './systems/rolling-stock/TfLElizabeth'
import TfLPiccadillyLine from './systems/rolling-stock/TfLPiccadillyLine'
import LnerAzuma from './systems/rolling-stock/LNERAzuma'

import TrainAnnouncementSystem from './TrainAnnouncementSystem'
import StationAnnouncementSystem from './StationAnnouncementSystem'
import AnnouncementSystem from './AnnouncementSystem'

export const AllTrainAnnouncementSystems: (typeof TrainAnnouncementSystem)[] = [
  ThameslinkClass700,
  BombardierXstar,
  TfWTrainFx,
  TfWTelevic,
  LnerAzuma,
]

export const AllStationAnnouncementSystems: (typeof StationAnnouncementSystem)[] = [
  // AtosMatt,
  // AtosAnne,
  AmeyPhil,
  AmeyCelia,
  ScotRail,
  Banedanmark,
]

export const AllOtherAnnouncementSystems: (typeof AnnouncementSystem)[] = [TfLJubileeLine, TfLNorthernLine, TfLElizabethLine, TfLPiccadillyLine]

export const AllAnnouncementSystems: (typeof AnnouncementSystem)[] = [
  ...AllStationAnnouncementSystems,
  ...AllTrainAnnouncementSystems,
  ...AllOtherAnnouncementSystems,
]
