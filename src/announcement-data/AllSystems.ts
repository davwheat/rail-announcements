import ThameslinkClass700 from './systems/rolling-stock/TLClass700'
import BombardierXstar from './systems/rolling-stock/BombardierXstar'
import TfWTrainFx from './systems/rolling-stock/TfWTrainFx'
import TfWTelevic from './systems/rolling-stock/TfWTelevic'
import FGWTrainFx from './systems/rolling-stock/FGWTrainFx'
import NorthernTrainFx from './systems/rolling-stock/NorthernTrainFx'

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

import type TrainAnnouncementSystem from './TrainAnnouncementSystem'
import type StationAnnouncementSystem from './StationAnnouncementSystem'
import type { AnnouncementSystemClass } from './AnnouncementSystem'

export const AllTrainAnnouncementSystems: AnnouncementSystemClass<TrainAnnouncementSystem>[] = [
  ThameslinkClass700,
  BombardierXstar,
  TfWTrainFx,
  TfWTelevic,
  LnerAzuma,
  FGWTrainFx,
  NorthernTrainFx,
]

export const AllStationAnnouncementSystems: AnnouncementSystemClass<StationAnnouncementSystem>[] = [
  // AtosMatt,
  // AtosAnne,
  AmeyPhil,
  AmeyCelia,
  ScotRail,
  Banedanmark,
]

export const AllOtherAnnouncementSystems: AnnouncementSystemClass[] = [TfLJubileeLine, TfLNorthernLine, TfLElizabethLine, TfLPiccadillyLine]

export const AllAnnouncementSystems: AnnouncementSystemClass[] = [
  ...AllStationAnnouncementSystems,
  ...AllTrainAnnouncementSystems,
  ...AllOtherAnnouncementSystems,
]
