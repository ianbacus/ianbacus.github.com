class MidiAbstractionLayer
{
    Initialize()
    {
        this.MaximumNotesPerBeat = 8.0;
        this.PitchLookupTable = {"c0":12,"d0":14,"e0":16,"f0":17,"g0":19,"a0":21,"b0":23};

        this.ActiveNotesMappedToTheirStartTick = {};
        this.TickToPitchMidiValueDictionary = {};
        this.TimeSignatureEvents = {};
        this.TabberInputData = '';
        this.Tempo = 120;

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

    ProcessNote(pitchMidiValue, currentTimeTicks, isNoteOff, track)
    {
        //Note on events: add the pitch information to the intermediate file for rendering in the tab
        var pitchMidiValueEntry =
        {
    		Type:'Note',
            Pitch:pitchMidiValue,
            Track:track,
            Duration:0,
        };

        //Note off events: update the durations of notes as they expire
        if(isNoteOff)
        {
            var tickValueOfActiveNote = this.ActiveNotesMappedToTheirStartTick[pitchMidiValue]
            var durationOfActiveNote = currentTimeTicks-tickValueOfActiveNote

            var entryIndex = 0;
            try
            {
                this.TickToPitchMidiValueDictionary[tickValueOfActiveNote].forEach(function(testPitchMidiValueEntry)
                {
                    if(testPitchMidiValueEntry.Pitch == pitchMidiValue)
                    {
                        var fixedDuration = Math.min(durationOfActiveNote,(this.MaximumNotesPerBeat*6));
                        this.TickToPitchMidiValueDictionary[tickValueOfActiveNote][entryIndex].Duration =fixedDuration;
                    }
                    entryIndex++;
                }, this);
            }
            catch(e)
            {
                onsole.log(e)
                //console.log(pitchMidiValue, currentTimeTicks, isNoteOff)
                //console.log(e, this.TickToPitchMidiValueDictionary, this.ActiveNotesMappedToTheirStartTick, tickValueOfActiveNote)
            }
        }

        //Note on events:
        else
        {
            this.ActiveNotesMappedToTheirStartTick[pitchMidiValue] = currentTimeTicks

            try
            {
                this.TickToPitchMidiValueDictionary[currentTimeTicks].push(pitchMidiValueEntry)
            }
            catch(e)
            {
                this.TickToPitchMidiValueDictionary[currentTimeTicks] = [pitchMidiValueEntry]
            }
        }
    }

    ParseMidiFile(midiFileObject)
    {
        var timeDivision = midiFileObject.timeDivision;
        var tracks = midiFileObject.track;
        var noteOnEvent = 9;
        var noteOffEvent = 8;
        var metaEvent = 255;

        var trackNumber = 0;

        console.log(timeDivision)

        this.ActiveNotesMappedToTheirStartTick = {};
        this.TickToPitchMidiValueDictionary = {};
        this.TimeSignatureEvents = {};
        this.TabberInputData = '';
        this.Tempo = 120;

        tracks.forEach(function(trackObject)
        {
            var track = trackObject.event;
            var trackAbsoluteTime = 0;

            var currentEventTickValue = 0

            track.forEach(function(midiEvent)
            {
                var noteDelta = midiEvent.deltaTime;
                var noteData = midiEvent.data;
                var noteType = midiEvent.type;

                trackAbsoluteTime += noteDelta;
                var noteAbsoluteStartTime = trackAbsoluteTime;

                var currentEventTickValue =  2*(noteAbsoluteStartTime*(this.MaximumNotesPerBeat/timeDivision))
                currentEventTickValue = Math.round(currentEventTickValue)

                if((noteType == noteOnEvent) || (noteType == noteOffEvent))
                {
                    var pitch = midiEvent.data[0];
                    var noteOffVelocityZero = midiEvent.data[1] < 0.65;
                    var isNoteOff = noteOffVelocityZero || (noteType == noteOffEvent);

                    this.ProcessNote(pitch, currentEventTickValue, isNoteOff, trackNumber)
                }

    			else if(noteType = metaEvent)
    			{
    				var metaEventType = midiEvent.metaType;

    				//Time signature
    				if(metaEventType == 0x58)
    				{
    					var timeSigString = noteData[0]+","+noteData[1]
    					var pitchMidiValueEntry =
    					{
    						Type:'TimeSignature',
    						Data:timeSigString,
    					}
    					this.TimeSignatureEvents[currentEventTickValue] = timeSigString;
    				}

                    //Tempo
                    else if(metaEventType == 0x51)
                    {
                        this.Tempo = (60000*1000) / (noteData);
                    }
    			}
            }, this, trackAbsoluteTime);

            trackNumber++;

        }, this, trackNumber);
    }

    ParsePitchDeltas()
    {
        this.TabberInputData = '';
        var tickInstanceKeyList = [];

        Object.keys(TickToPitchMidiValueDictionary).forEach(function(currentTicks)
        {
            tickInstanceKeyList.push(parseInt(currentTicks));
        });

        var lastTick = tickInstanceKeyList[tickInstanceKeyList.length-1];
        tickInstanceKeyList.push(lastTick+4);
        for(var index = 0; index<tickInstanceKeyList.length-1; index++)
        {
            var currentTicks = tickInstanceKeyList[index];
            var nextTicks = tickInstanceKeyList[index+1];
            var delta = nextTicks - currentTicks;

            var pitchList = this.TickToPitchMidiValueDictionary[currentTicks];

    		Object.keys(timeSignatureEvents).forEach(function(timeSignatureTick)
    		{
    			if(timeSignatureTick == currentTicks)
    			{
    				var resString = 'SIGEVENT\r\n' + this.TimeSignatureEvents[timeSignatureTick] + '\r\n';
    				this.TabberInputData += resString;
    			}
    		}, this, currentTicks);

            pitchList.sort(function(a,b) { return a.Pitch - b.Pitch;});
            pitchList.forEach(function(pitchDuration)
            {
                var pitch = pitchDuration.Pitch;
                var duration = pitchDuration.Duration;
                var track = pitchDuration.Track;

                var resString = pitch+ "," +delta+ "," +track+ "," +duration + "\r\n";
                delta = 0;
                this.TabberInputData += resString;

            },delta);
        }
    }

    ConvertPitchDeltasToScoreModel()
    {
        var score = [];

        Object.keys(this.TickToPitchMidiValueDictionary).forEach(function(currentTicks)
        {
            var pitchList = this.TickToPitchMidiValueDictionary[currentTicks];
            pitchList.forEach(function(pitchDuration)
            {
                var startTimeTicks = parseInt(currentTicks);
                var pitch = parseInt(pitchDuration.Pitch);
                var duration = parseInt(pitchDuration.Duration);
                var track = parseInt(pitchDuration.Track);

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

        return score;
    }

    GenerateKeyboardTab(event)
    {
        Object.keys(TickToPitchMidiValueDictionary).forEach(function(currentTicks)
        {
            tickInstanceKeyList.push(parseInt(currentTicks));
        });

        var lastTick = tickInstanceKeyList[tickInstanceKeyList.length-1];
        tickInstanceKeyList.push(lastTick+4);
        for(var index = 0; index<tickInstanceKeyList.length-1; index++)
        {
            var currentTicks = tickInstanceKeyList[index];
            var nextTicks = tickInstanceKeyList[index+1];
            var delta = nextTicks - currentTicks;

            var pitchList = this.TickToPitchMidiValueDictionary[currentTicks];

            pitchList.sort(function(a,b) { return a.Pitch - b.Pitch;});
            pitchList.forEach(function(pitchDuration)
            {
                var pitch = pitchDuration.Pitch;
                var duration = pitchDuration.Duration;
                var track = pitchDuration.Track;

                var resString = pitch+ "," +delta+ "," +track+ "," +duration + "\r\n";
                delta = 0;
                this.TabberInputData += resString;

            },delta);
        }
    }


    GenerateTab(event)
    {
        var tuningPitches = [23, 28, 33, 38, 43, 47,52];
        var tuningStrings = "BEADGBe";

        ParsePitchDeltas();

        var failure = undefined;

        if(ParseString.length > 0)
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

    		},tuningPitches, tuningStrings);
        }

        else
        {
            failure = "Please provide a midi file"
        }

        if(failure == undefined)
        {
            var outString = this.TabberMethod(
    			this.TabberInputData,
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

    	return {failureReason: failure, tablatureString: outString};

    }
}