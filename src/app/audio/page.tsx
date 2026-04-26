import { loadAudioAction } from "../actions/audio";
import { AudioScreen } from "../../components/audio-screen";

export default function AudioPage() {
  return <AudioScreen loadAudioAction={loadAudioAction} />;
}
