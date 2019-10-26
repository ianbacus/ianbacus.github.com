class MidiAbstractionLayer
{
    Initialize()
    {
        this.MaximumNotesPerBeat = 8.0;
        this.PitchLookupTable = {"c0":12,"d0":14,"e0":16,"f0":17,"g0":19,"a0":21,"b0":23};

        //this.ActiveNotesMappedToTheirStartTick = {};
        //this.TickToPitchMidiValueDictionary = {};
        //this.TimeSignatureEvents = {};
        this.TabberInputData = '';
        this.TabberMethod = Module.cwrap('javascriptWrapperFunction', 'string',
            [
                'string',
                'string',
                'array',
                'number',
                'number',
                'number',
                'number',
                'number',
                'number',
                'number',
                'number',
        ]);

        var pitches = ['c','d','e','f','g','a','b'];

        for(var octaveOffset=1; octaveOffset<8; octaveOffset++)
        {
            var offset = octaveOffset*12;

            pitches.forEach(function(pitch)
            {
                var basePitchKey = pitch+'0';
                var newPitchKey = pitch+octaveOffset;
                var basePitch = this.PitchLookupTable[basePitchKey];
                var newPitch = basePitch + offset;

                this.PitchLookupTable[newPitchKey] = newPitch;
            }, this, octaveOffset);
        }
    }

    //Convert a score note buffer into a midi file.
	GenerateMidiFile(score)
	{
		var file = new Midi.File();
		var track1 = file.addTrack();
		var track = file.addTrack();
		var currentTime = 0;
		var timeIndexedInformation = {};

		var activeNotes = {};

		score.forEach(function(note)
		{
			var startTimeTicks = note.StartTimeTicks;
			var duration = note.Duration;
			var endTimeTicks = startTimeTicks + duration;

			var pitch = note.Pitch;
			var currentTrack = note.CurrentTrack;

            console.log(note)

			var noteOnEvent =
			{
				Note: note,
				Type: "on"
			}

			var noteOffEvent =
			{
				Note: note,
				Type: "off"
			}

			if(timeIndexedInformation[startTimeTicks] == undefined)
			{
				timeIndexedInformation[startTimeTicks] = [noteOnEvent];
			}

			else
			{
				timeIndexedInformation[startTimeTicks].push(noteOnEvent)
			}

			if(timeIndexedInformation[endTimeTicks] == undefined)
			{
				timeIndexedInformation[endTimeTicks] = [noteOffEvent];
			}

			else
			{
				timeIndexedInformation[endTimeTicks].push(noteOffEvent);
			}
		},timeIndexedInformation)


        var lastTimeInstant = 0;
		Object.keys(timeIndexedInformation).forEach(function(timeInstant)
		{
			var noteEvents = timeIndexedInformation[timeInstant]
            var timeInstantInteger = parseInt(timeInstant);

			noteEvents.forEach(function(noteEvent)
			{
                var note = noteEvent.Note;

                var duration = note.Duration;
    			var pitch = note.Pitch;

                var delta = (timeInstantInteger - lastTimeInstant)*16

				if(noteEvent.Type == "on")
				{
					track.noteOn(0, pitch, delta);
				}

				else
				{
					track.noteOff(0, pitch, delta);
				}

                lastTimeInstant = timeInstantInteger;

			}, track, timeInstantInteger, lastTimeInstant);


	}, track, timeIndexedInformation, lastTimeInstant)

    return file.toBytes();

    }

    //Update ActiveNotesMappedToTheirStartTick and TickToPitchMidiValueDictionary
    ProcessMidiNoteOn(pitchMidiValueEntry, currentTimeTicks, chordMap, activeNoteMap)
    {
        // this.ActiveNotesMappedToTheirStartTick[pitchMidiValue] = currentTimeTicks;
        activeNoteMap[pitchMidiValueEntry.Pitch] = currentTimeTicks;

        try
        {
            //this.TickToPitchMidiValueDictionary[currentTimeTicks].push(pitchMidiValueEntry);
            chordMap[currentTimeTicks].push(pitchMidiValueEntry);
        }
        catch(e)
        {
            //this.TickToPitchMidiValueDictionary[currentTimeTicks] = [pitchMidiValueEntry];
            chordMap[currentTimeTicks] = [pitchMidiValueEntry];
        }

    } //ProcessMidiNoteOn

    ProcessMidiNoteOff(pitchMidiValueEntry, currentTimeTicks, chordMap, activeNoteMap)
    {
        //Note off events: lookup note start time, calculate note duration. Lookup note on event with start time,
        //
        //var noteStartTicks = this.ActiveNotesMappedToTheirStartTick[pitchMidiValue];
        var noteStartTicks = activeNoteMap[pitchMidiValueEntry.Pitch];
        var noteDuration = currentTimeTicks - noteStartTicks

        var entryIndex = 0;
        try
        {
            //var chordAtNoteStart = this.TickToPitchMidiValueDictionary[noteStartTicks];
            var chordAtNoteStart = chordMap[noteStartTicks];
            chordAtNoteStart.forEach(function(chordNoteMidiEntry)
            {
                if(chordNoteMidiEntry.Pitch == pitchMidiValueEntry.Pitch)
                {
                    var fixedDuration = Math.min(noteDuration,(this.MaximumNotesPerBeat*6));
                    chordNoteMidiEntry.Duration = fixedDuration;
                }
                //noteChordIndex++;
            }, this);
        }
        catch(e)
        {
            console.log(e)
        }

    } //ProcessMidiNoteOff

    ParseMidiTrack(trackObject, trackNumber, metaEventMap, chordMap, activeNoteMap, timeDivision)
    {
        var track = trackObject.event;
        var trackAbsoluteTime = 0;

        var currentEventTickValue = 0

        track.forEach(function(midiEvent)
        {
            var noteDelta = midiEvent.deltaTime;
            var noteData = midiEvent.data;
            var noteType = midiEvent.type;

            var noteOnEvent = 9;
            var noteOffEvent = 8;
            var metaEvent = 255;

            trackAbsoluteTime += noteDelta;
            var noteAbsoluteStartTime = trackAbsoluteTime;

            var currentEventTickValue =  2 * (noteAbsoluteStartTime * (this.MaximumNotesPerBeat / timeDivision));
            currentEventTickValue = Math.round(currentEventTickValue);

            //Note events
            if((noteType == noteOnEvent) || (noteType == noteOffEvent))
            {
                var pitch = midiEvent.data[0];
                var noteOffVelocityZero = midiEvent.data[1] < 0.65;
                var isNoteOff = noteOffVelocityZero || (noteType == noteOffEvent);

                var pitchMidiValueEntry =
                {
                    Type:'Note',
                    Pitch:pitch,
                    Track:trackNumber,
                    Duration:0,
                };

                if(isNoteOff)
                {
                    this.ProcessMidiNoteOff(pitchMidiValueEntry, currentEventTickValue, chordMap, activeNoteMap);
                }
                else
                {
                    this.ProcessMidiNoteOn(pitchMidiValueEntry, currentEventTickValue, chordMap, activeNoteMap);
                }
            }

            else if(noteType = metaEvent)
            {
                var metaEventType = midiEvent.metaType;
                var timeSignatureTypeCode = 0x58;

                if(metaEventType == timeSignatureTypeCode)
                {
                    var timeSignatureString = noteData[0]+","+noteData[1]
                    var metaEventEntry ={Type:'TimeSignature', Data:timeSignatureString,}
                    metaEventMap[currentEventTickValue] = metaEventEntry;
                }
            }
        }, this, trackAbsoluteTime);

    } //ParseMidiTrack

    ParseMidiFileToChordMap(midiData, chordMap, metaEventMap)
    {
        var midiFileObject = MidiParser.parse(midiData);
        this.TabberInputData = '';//TODO remove this

        var timeDivision = midiFileObject.timeDivision;
        var tracks = midiFileObject.track;

        var trackNumber = 0;
        var activeNoteMap = {};

        tracks.forEach(function(trackObject)
        {
            this.ParseMidiTrack(trackObject, trackNumber, metaEventMap, chordMap, activeNoteMap, timeDivision);
            trackNumber += 1;

        }, this, trackNumber, chordMap, metaEventMap, activeNoteMap);

    } //ParseMidiFileToChordMap

    GetTabberStringFromChordMap(chordMap, metaEventMap)
    {
        //this.TabberInputData = '';
        var tabberData = ''
        var tickInstanceKeyList = [];
        //var chordMap = this.TickToPitchMidiValueDictionary
        //var metaEventMap = this.TimeSignatureEvents

        //Pull ticks from the chord map
        //Object.keys(this.TickToPitchMidiValueDictionary).forEach(function(currentTicks)
        Object.keys(chordMap).forEach(function(currentTicks)
        {
            tickInstanceKeyList.push(parseInt(currentTicks));
        });

        Object.keys(metaEventMap).forEach(function(currentTicks)
        {
            tickInstanceKeyList.push(parseInt(currentTicks));
        });

        tickInstanceKeyList.sort(function(a,b){a<b;});

        //Process note blocks and meta events at each tick
        var lastTickIndex = tickInstanceKeyList.length - 1;
        var lastTick = tickInstanceKeyList[lastTickIndex];
        tickInstanceKeyList.push(lastTick+4); //Push an "end-of-score" tick.

        for(var tickIndex = 0; tickIndex < lastTickIndex+1; tickIndex++)
        {
            var currentTicks = tickInstanceKeyList[tickIndex];
            var nextTicks = tickInstanceKeyList[tickIndex+1];
            var delta = nextTicks - currentTicks;
            console.log(currentTicks)
            if(delta < 0)
            {
                continue;
                //TODO: this shouldn't happen if sort works properly, negative deltas will break the tabber program
            }

            if(metaEventMap[currentTicks] !== undefined)
            {
                var metaEvent = metaEventMap[currentTicks];
                if(metaEvent.Type == "TimeSignature")
                {
    				var resString = 'SIGEVENT\r\n' + metaEvent.Data + '\r\n';
                    console.log(resString);
    				tabberData += resString;
                }
            }

            //Append note information
            if(chordMap[currentTicks] !== undefined)
            {
                var pitchList = chordMap[currentTicks];
                pitchList.sort(function(a,b) { return a.Pitch - b.Pitch;});
                pitchList.forEach(function(pitchEntry)
                {
                    var pitch = pitchEntry.Pitch;
                    var duration = pitchEntry.Duration;
                    var track = pitchEntry.Track;

                    var resString = pitch+ "," +delta+ "," +track+ "," +duration + "\r\n";
                    console.log(resString);
                    delta = 0;
                    tabberData += resString;

                },this, delta, tabberData);
            }
        }

        return tabberData;

    } //GetTabberStringFromChordMap

    ConvertPitchDeltasToScoreModel(chordMap)
    {
        var score = [];
        var trackList = [];

        Object.keys(chordMap).forEach(function(currentTicks)
        {
            var pitchList = chordMap[currentTicks];
            pitchList.forEach(function(pitchDuration)
            {
                var startTimeTicks = parseInt(currentTicks);
                var pitch = parseInt(pitchDuration.Pitch);
                var duration = parseInt(pitchDuration.Duration);
                var track = parseInt(pitchDuration.Track);

                if(!trackList.includes(track))
                {
                    trackList.push(track);
                }

                var note = new Note(
                    startTimeTicks,
                    pitch,
                    duration,
                    track,
                    false);

                score.push(note);

            }, currentTicks);
        }, this);

        $(".loader").hide();

        return {
            noteBuffer: score,
            tracks: trackList
        };

    } //ConvertPitchDeltasToScoreModel

    //Import options:
    //midi file
    //"from canvas"

    //Export options:
    //midi file
    //tablature
    ExportMidiNotes(score,filename)
    {
        var fileData = this.GenerateMidiFile(score)

        //Translate midi data to byte array
        const bytes = new Uint8Array(fileData.length);
        for (let i = 0; i < fileData.length; i++)
        {
            bytes[i] = fileData.charCodeAt(i);
        }

        //Save midi file
        var blob = new Blob([bytes], {type: "audio/midi; charset=binary"});
        saveAs(blob, filename);
    }

    GenerateTabFromCanvas(score)
    {
        var fileData = this.GenerateMidiFile(score);

        //Translate midi data to byte array
        const bytes = new Uint8Array(fileData.length);
        for (let i = 0; i < fileData.length; i++)
        {
            bytes[i] = fileData.charCodeAt(i);
        }

        //Save midi file
        //var blob = new Blob([bytes], {type: "audio/midi; charset=binary"});

        var chordMap = {};
        var metaEventMap = {};
        this.ParseMidiFileToChordMap(bytes, chordMap, metaEventMap);

        //Return tabResultData, {failureReason: undefined, tablatureString: ""}
        return this.GenerateTabFromChordMap(chordMap, metaEventMap);
    }

    GenerateTabFromChordMap(chordMap, metaEventMap)
    {
        var tabberString = this.GetTabberStringFromChordMap(chordMap, metaEventMap);
        console.log(tabberString);
        chordMap = null;
        metaEventMap = null;

        //Return tabResultData, {failureReason: undefined, tablatureString: ""}
        return this.GenerateTabFromTabberString(tabberString);;
    }

    GenerateTabFromTabberString(tabberData)
    {
        var tuningPitches = [23, 28, 33, 38, 43, 47,52];
        var tuningStrings = "BEADGBe";

        var failure = undefined;

        if(tabberData.length > 0)
        {
    		var frets = $('#frets').val();;
    		var neckCost = $('#neckCost').val();// 1500;
    		var spanCost = $('#spanCost').val();// 3000;
    		var diffCost = $('#diffCost').val();// 7500;
    		var sustainCost = $('#sustainCost').val();// 1000;
    		var arpeggioCost = $('#arpeggioCost').val();// 1000;
    		var columnFormat = $('#screenLength').val();// 250;
    		var transpose = $('#transpose').val();// 250;
    		var instrumentStrings = $('#strings').val();// 250;

    		var tuningPitches = []
    		var tuningStrings = "";

    		var splitInstrumentStrings = instrumentStrings.split(',');
    		splitInstrumentStrings.some(function(stringName)
    		{
    			var stringNameTruncated = stringName[0];
    			var stringPitch = this.PitchLookupTable[stringName];

                if(stringPitch == undefined)
                {
                    failure = "Invalid tuning string " + instrumentStrings;
                    console.log(failure,splitInstrumentStrings);
                    return;
                }

    			tuningPitches.push(stringPitch);
    			tuningStrings += stringNameTruncated;

    		},this, tuningPitches, tuningStrings);
        }

        else
        {
            failure = "Please provide a midi file"
        }

        if(failure == undefined)
        {
            try
            {
                var outString = this.TabberMethod(
        			tabberData,
        			tuningStrings,
        			tuningPitches,
                    transpose,
        			frets,
        			neckCost,
        			spanCost,
        			diffCost,
        			sustainCost,
        			arpeggioCost,
        			columnFormat);
            }

            catch(e)
            {
                alert("Error generating tablature: "+ e);
                outString = "";
            }
    	}

    	return {failureReason: failure, tablatureString: outString};

    }
}
