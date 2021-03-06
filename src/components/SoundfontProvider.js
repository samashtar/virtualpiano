import React from "react";
import PropTypes from "prop-types";
import Soundfont from "soundfont-player";

let thisRecording = [];

class SoundfontProvider extends React.Component {
  // this fetches and loads the sound
  static propTypes = {
    instrumentName: PropTypes.string.isRequired,
    hostname: PropTypes.string.isRequired,
    format: PropTypes.oneOf(["mp3", "ogg"]),
    soundfont: PropTypes.oneOf(["MusyngKite", "FluidR3_GM"]),
    audioContext: PropTypes.instanceOf(window.AudioContext),
    render: PropTypes.func
  };

  static defaultProps = {
    format: "mp3",
    soundfont: "MusyngKite",
    instrumentName: "acoustic_grand_piano"
  };

  constructor(props) {
    super(props);
    this.state = {
      activeAudioNodes: {},
      instrument: null
    };
  }

  componentDidMount() {
    this.loadInstrument(this.props.instrumentName);
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevProps.instrumentName !== this.props.instrumentName) {
      this.loadInstrument(this.props.instrumentName);
    }
  }

  loadInstrument = instrumentName => {
    this.setState({
      instrument: null
    });
    Soundfont.instrument(this.props.audioContext, instrumentName, {
      format: this.props.format,
      soundfont: this.props.soundfont,
      nameToUrl: (name, soundfont, format) => {
        return `${this.props.hostname}/${soundfont}/${name}-${format}.js`;
      }
    }).then(instrument => {
      this.setState({
        instrument
      });
    });
  };
  playNote = midiNumber => {
    let time1 = Date.now() / 1000;
    this.props.audioContext.resume().then(() => {
      const audioNode = this.state.instrument.play(midiNumber);
      this.setState({
        activeAudioNodes: Object.assign({}, this.state.activeAudioNodes, {
          [midiNumber]: audioNode
        })
      });
      if (this.props.recordingStatus === "RECORDING") {
        thisRecording.unshift({ audioNode, midiNumber, time1 });
      }
    });
  };

  startThisRecording = e => {
    if (this.props.recordingStatus !== "RECORDING") {
      thisRecording.startTime = Date.now() / 1000;
    }
    this.props.startRecording();
  };

  clearThisRecording = () => {
    thisRecording = [];
    this.props.clearRecording();
  };

  playThisRecording = () => {
    let beginningTime = thisRecording["startTime"];
    let recording = [];
    // reverse the entire array of objects
    // time 1 and time 2 difference of a midi number - how long note has been held
    // start Time - when to play based on difference from start time
    // ex: time1: 10, time2: 5 , start time 15 sec
    // means start note at the 5 second mark and hold for 5 seconds
    // setInterval(this.playNote(el.midiNumber, holdTime)
    thisRecording.reverse().map(el => {
      let holdTime = (el.time2 - el.time1) * 1000;
      console.log(holdTime);
      let midiNumber = el.midiNumber;
      let startNoteTime = (el.time1 - beginningTime) * 1000;
      setTimeout(
        function() {
          this.playNote(el.midiNumber);
          setTimeout(
            function() {
              this.stopNote(el.midiNumber);
            }.bind(this),
            holdTime
          );
        }.bind(this),
        startNoteTime
      );
    });
    this.props.playRecording();
  };
  stopNote = midiNumber => {
    let time = Date.now() / 1000;
    this.props.audioContext.resume().then(() => {
      if (!this.state.activeAudioNodes[midiNumber]) {
        return;
      }
      const audioNode = this.state.activeAudioNodes[midiNumber];
      if (this.props.recordingStatus === "RECORDING") {
        let pair = thisRecording.find(el => el.midiNumber === midiNumber);
        pair["time2"] = time;
        console.log(thisRecording);
      }
      audioNode.stop();
      this.setState({
        activeAudioNodes: Object.assign({}, this.state.activeAudioNodes, {
          [midiNumber]: null
        })
      });
    });
  };

  // Clear any residual notes that don't get called with stopNote
  stopAllNotes = () => {
    this.props.audioContext.resume().then(() => {
      const activeAudioNodes = Object.values(this.state.activeAudioNodes);
      activeAudioNodes.forEach(node => {
        if (node) {
          node.stop();
        }
      });
      this.setState({
        activeAudioNodes: {}
      });
    });
  };

  saveThisRecording = () => {
    let saved = JSON.stringify([
      ...thisRecording,
      { startTime: thisRecording["startTime"] }
    ]);
    console.log(saved);
    let data = JSON.stringify({
      name: "SongName",
      user_id: 1,
      data: saved
    });

    fetch("http://localhost:6969/songs", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: data
    });
    this.props.saveRecording();
  };

  listenToRecording = song => {
    console.log(song);
    let parsedSong = JSON.parse(song.data);

    let beginningTime = parsedSong.slice(-1)[0].startTime;

    let recording = parsedSong.filter(el => el.audioNode);

    // reverse the entire array of objects
    // time 1 and time 2 difference of a midi number - how long note has been held
    // start Time - when to play based on difference from start time
    // ex: time1: 10, time2: 5 , start time 15 sec
    // means start note at the 5 second mark and hold for 5 seconds
    // setInterval(this.playNote(el.midiNumber, holdTime)
    recording.reverse().map(el => {
      let holdTime = (el.time2 - el.time1) * 1000;
      console.log(holdTime);
      let midiNumber = el.midiNumber;
      let startNoteTime = (el.time1 - beginningTime) * 1000;
      setTimeout(
        function() {
          this.playNote(el.midiNumber);
          setTimeout(
            function() {
              this.stopNote(el.midiNumber);
            }.bind(this),
            holdTime
          );
        }.bind(this),
        startNoteTime
      );
    });
    this.props.playRecording();
  };

  render() {
    return this.props.render({
      saveRecording: this.saveThisRecording,
      startRecording: this.startThisRecording.bind(this),
      clearRecording: this.clearThisRecording,
      isLoading: !this.state.instrument,
      playNote: this.playNote,
      stopNote: this.stopNote,
      stopAllNotes: this.stopAllNotes,
      playRecording: this.playThisRecording,
      listenToRecording: this.listenToRecording
    });
  }
}

export default SoundfontProvider;
