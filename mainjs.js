class disabledConsole
{
    constructor() {}
    log() {} //Do nothing
};

let ScoreView = new View();
let ScoreModel = new Model();
let ScoreController = new Controller(ScoreView,ScoreModel);

ScoreView.console = new disabledConsole();
ScoreModel.console = new disabledConsole();
ScoreController.console = new disabledConsole();


// ScoreView.console = console;
// ScoreModel.console = console;
//ScoreController.console = console;
var activeNotesMappedToTheirStartTick = {};
var TickToPitchMidiValueDictionary = {};
var MaximumNotesPerBeat = 8.0;

function ProcessNote(pitchMidiValue, currentTimeTicks, isNoteOff, track)
{
    //Note on events: add the pitch information to the intermediate file for rendering in the tab
    var pitchMidiValueEntry =
    {
        Pitch:pitchMidiValue,
        Track:track,
        Duration:0,
    };

    //Note off events: update the durations of notes as they expire
    if(isNoteOff)
    {
        var tickValueOfActiveNote = activeNotesMappedToTheirStartTick[pitchMidiValue]
        var durationOfActiveNote = currentTimeTicks-tickValueOfActiveNote

        //for entryIndex, testPitchMidiValueEntry in enumerate(TickToPitchMidiValueDictionary[tickValueOfActiveNote]):
        var entryIndex = 0;
        try
        {
            TickToPitchMidiValueDictionary[tickValueOfActiveNote].forEach(function(testPitchMidiValueEntry)
            {
                if(testPitchMidiValueEntry.Pitch == pitchMidiValue)
                {
                    var fixedDuration = Math.min(durationOfActiveNote,(MaximumNotesPerBeat*6));
                    TickToPitchMidiValueDictionary[tickValueOfActiveNote][entryIndex].Duration =fixedDuration;
                }
                entryIndex++;
            }, TickToPitchMidiValueDictionary);
        }
        catch(e)
        {
            console.log(pitchMidiValue, currentTimeTicks, isNoteOff)
            console.log(e, TickToPitchMidiValueDictionary, activeNotesMappedToTheirStartTick, tickValueOfActiveNote)
        }

    }

    //Note on events:
    else
    {
        activeNotesMappedToTheirStartTick[pitchMidiValue] = currentTimeTicks

        try
        {
            TickToPitchMidiValueDictionary[currentTimeTicks].push(pitchMidiValueEntry)
        }
        catch(e)
        {
            TickToPitchMidiValueDictionary[currentTimeTicks] = [pitchMidiValueEntry]
        }
    }
}


function ParseMidiFile(midiFileObject)
{
    var timeDivision = midiFileObject.timeDivision;
    var tracks = midiFileObject.track;
    var noteOnEvent = 9;
    var noteOffEvent = 8;

    var trackNumber = 0;
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

            var currentEventTickValue =  2*(noteAbsoluteStartTime*(MaximumNotesPerBeat/timeDivision))
            currentEventTickValue = Math.round(currentEventTickValue)

            //Time signature events are added to a separate data structure
            //if type(midiEvent) is midi.events.TimeSignatureEvent:
                //timeSignatureEvents[currentEventTickValue] = midiEvent.get_numerator(),midiEvent.get_denominator()

            if((noteType == noteOnEvent) || (noteType == noteOffEvent))
            {
                var pitch = midiEvent.data[0];
                var noteOffVelocityZero = midiEvent.data[1] < 1.0;
                var isNoteOff = noteOffVelocityZero || (noteType == noteOffEvent);

                ProcessNote(pitch, currentEventTickValue, isNoteOff, trackNumber)
            }
        }, trackAbsoluteTime);

        trackNumber++;

    }, trackNumber);

    var parseString = '';

    var lastDeltaKey = 0;
    Object.keys(TickToPitchMidiValueDictionary).forEach(function(deltaKey) {
        var pitchList = TickToPitchMidiValueDictionary[deltaKey];
        var delta = undefined;
        pitchList.sort(function(a,b) { return a.Pitch - b.Pitch;});
        pitchList.forEach(function(pitchDuration)
        {
            var pitch = pitchDuration.Pitch;
            var duration = pitchDuration.Duration;
            var track = pitchDuration.Track;

            if(delta == undefined)
            {
                delta = deltaKey - lastDeltaKey;
                lastDeltaKey = deltaKey;
                var resString = pitch+ "," +delta+ "," +track+ "," +duration + "\r\n";
            }
            else
            {
                var resString = pitch+ "," +0+ "," +track+ "," +duration + "\r\n";
            }
            parseString += resString;
        },parseString, delta);

    }, parseString,lastDeltaKey);

    var z = Module.ccall('javascriptWrapperFunction', 'number', ['string'], [parseString]);


}

Dropzone.options.importDropzone = {
    paramName: "file", // The name that will be used to transfer the file
    maxFilesize: 2, // MB
    accept: function(file, done)
    {
        var reader = new FileReader();

        // Closure to capture the file information.
        reader.onload = (function(event)
        {
            var midiData = new Uint8Array(event.target.result);
            console.log(midiData);
            var array = MidiParser.parse(midiData);
            ParseMidiFile(array);
        });

        reader.readAsArrayBuffer(file);

    }
};

function testEmscript()
{
    var str = '{"0":[{"Pitch":49,"Duration":4}],"4":[{"Pitch":64,"Duration":4}],"8":[{"Pitch":71,"Duration":8},{"Pitch":63,"Duration":4}],"12":[{"Pitch":64,"Duration":4}],"16":[{"Pitch":76,"Duration":8},{"Pitch":56,"Duration":4}],"20":[{"Pitch":64,"Duration":4}],"24":[{"Pitch":71,"Duration":8},{"Pitch":63,"Duration":4}],"28":[{"Pitch":64,"Duration":4}],"32":[{"Pitch":73,"Duration":8},{"Pitch":57,"Duration":4}],"36":[{"Pitch":64,"Duration":4}],"40":[{"Pitch":69,"Duration":8},{"Pitch":66,"Duration":4}],"44":[{"Pitch":64,"Duration":4}],"48":[{"Pitch":66,"Duration":8},{"Pitch":63,"Duration":4}],"52":[{"Pitch":61,"Duration":4}],"56":[{"Pitch":71,"Duration":8},{"Pitch":59,"Duration":4}],"60":[{"Pitch":57,"Duration":4}],"64":[{"Pitch":64,"Duration":8},{"Pitch":56,"Duration":4}],"68":[{"Pitch":64,"Duration":4}],"72":[{"Pitch":66,"Duration":4},{"Pitch":63,"Duration":4}],"76":[{"Pitch":68,"Duration":4},{"Pitch":64,"Duration":4}],"80":[{"Pitch":69,"Duration":8},{"Pitch":61,"Duration":4}],"84":[{"Pitch":64,"Duration":4}],"88":[{"Pitch":68,"Duration":8},{"Pitch":59,"Duration":4}],"92":[{"Pitch":64,"Duration":4}],"96":[{"Pitch":66,"Duration":8},{"Pitch":57,"Duration":4}],"100":[{"Pitch":64,"Duration":4}],"104":[{"Pitch":71,"Duration":8},{"Pitch":56,"Duration":4}],"108":[{"Pitch":64,"Duration":4}],"112":[{"Pitch":69,"Duration":8},{"Pitch":54,"Duration":4}],"116":[{"Pitch":64,"Duration":4}],"120":[{"Pitch":68,"Duration":8},{"Pitch":52,"Duration":4}],"124":[{"Pitch":64,"Duration":4}],"128":[{"Pitch":66,"Duration":4},{"Pitch":63,"Duration":2}],"132":[{"Pitch":71,"Duration":4}],"136":[{"Pitch":70,"Duration":4},{"Pitch":54,"Duration":8}],"140":[{"Pitch":71,"Duration":4}],"144":[{"Pitch":63,"Duration":4},{"Pitch":59,"Duration":8}],"148":[{"Pitch":71,"Duration":4}],"152":[{"Pitch":70,"Duration":4},{"Pitch":54,"Duration":8}],"156":[{"Pitch":71,"Duration":4}],"160":[{"Pitch":64,"Duration":4},{"Pitch":56,"Duration":8}],"164":[{"Pitch":71,"Duration":4}],"168":[{"Pitch":73,"Duration":4},{"Pitch":52,"Duration":8}],"172":[{"Pitch":71,"Duration":4}],"176":[{"Pitch":70,"Duration":4},{"Pitch":49,"Duration":8}],"180":[{"Pitch":68,"Duration":4}],"184":[{"Pitch":66,"Duration":4},{"Pitch":54,"Duration":8}],"188":[{"Pitch":64,"Duration":4}],"192":[{"Pitch":63,"Duration":4},{"Pitch":47,"Duration":8}],"196":[{"Pitch":71,"Duration":4}],"200":[{"Pitch":70,"Duration":4},{"Pitch":49,"Duration":4}],"204":[{"Pitch":71,"Duration":4},{"Pitch":51,"Duration":4}],"208":[{"Pitch":68,"Duration":4},{"Pitch":52,"Duration":8}],"212":[{"Pitch":71,"Duration":4}],"216":[{"Pitch":66,"Duration":4},{"Pitch":51,"Duration":8}],"220":[{"Pitch":71,"Duration":4}],"224":[{"Pitch":64,"Duration":4},{"Pitch":49,"Duration":8}],"228":[{"Pitch":71,"Duration":4}],"232":[{"Pitch":63,"Duration":4},{"Pitch":54,"Duration":8}],"236":[{"Pitch":71,"Duration":4}],"240":[{"Pitch":61,"Duration":4},{"Pitch":52,"Duration":8}],"244":[{"Pitch":71,"Duration":4}],"248":[{"Pitch":59,"Duration":4},{"Pitch":51,"Duration":8}],"252":[{"Pitch":71,"Duration":4}],"256":[{"Pitch":70,"Duration":2},{"Pitch":49,"Duration":4}],"260":[{"Pitch":54,"Duration":4}],"264":[{"Pitch":73,"Duration":8},{"Pitch":52,"Duration":4}],"268":[{"Pitch":54,"Duration":4}],"272":[{"Pitch":78,"Duration":8},{"Pitch":51,"Duration":4}],"276":[{"Pitch":54,"Duration":4}],"280":[{"Pitch":73,"Duration":8},{"Pitch":52,"Duration":4}],"284":[{"Pitch":54,"Duration":4}],"288":[{"Pitch":75,"Duration":8},{"Pitch":48,"Duration":4}],"292":[{"Pitch":54,"Duration":4}],"296":[{"Pitch":72,"Duration":8},{"Pitch":56,"Duration":4}],"300":[{"Pitch":54,"Duration":4}],"304":[{"Pitch":68,"Duration":8},{"Pitch":52,"Duration":4}],"308":[{"Pitch":51,"Duration":4}],"312":[{"Pitch":78,"Duration":8},{"Pitch":49,"Duration":4}],"316":[{"Pitch":48,"Duration":4}],"320":[{"Pitch":76,"Duration":4},{"Pitch":49,"Duration":8}],"324":[{"Pitch":81,"Duration":4}],"328":[{"Pitch":80,"Duration":4},{"Pitch":52,"Duration":8}],"332":[{"Pitch":81,"Duration":4}],"336":[{"Pitch":78,"Duration":4},{"Pitch":57,"Duration":8}],"340":[{"Pitch":81,"Duration":4}],"344":[{"Pitch":80,"Duration":4},{"Pitch":52,"Duration":8}],"348":[{"Pitch":81,"Duration":4}],"352":[{"Pitch":75,"Duration":4},{"Pitch":54,"Duration":8}],"356":[{"Pitch":81,"Duration":4}],"360":[{"Pitch":83,"Duration":4},{"Pitch":51,"Duration":8}],"364":[{"Pitch":81,"Duration":4}],"368":[{"Pitch":80,"Duration":4},{"Pitch":47,"Duration":8}],"372":[{"Pitch":78,"Duration":4}],"376":[{"Pitch":76,"Duration":4},{"Pitch":57,"Duration":8}],"380":[{"Pitch":75,"Duration":4}],"384":[{"Pitch":76,"Duration":2},{"Pitch":56,"Duration":4}],"388":[{"Pitch":52,"Duration":4}],"392":[{"Pitch":71,"Duration":8},{"Pitch":51,"Duration":4}],"396":[{"Pitch":52,"Duration":4}],"400":[{"Pitch":76,"Duration":8},{"Pitch":49,"Duration":4}],"404":[{"Pitch":52,"Duration":4}],"408":[{"Pitch":71,"Duration":8},{"Pitch":51,"Duration":4}],"412":[{"Pitch":52,"Duration":4}],"416":[{"Pitch":73,"Duration":8},{"Pitch":45,"Duration":4}],"420":[{"Pitch":52,"Duration":4}],"424":[{"Pitch":69,"Duration":8},{"Pitch":54,"Duration":4}],"428":[{"Pitch":52,"Duration":4}],"432":[{"Pitch":66,"Duration":8},{"Pitch":51,"Duration":4}],"436":[{"Pitch":49,"Duration":4}],"440":[{"Pitch":71,"Duration":8},{"Pitch":47,"Duration":4}],"444":[{"Pitch":45,"Duration":4}],"448":[{"Pitch":64,"Duration":8},{"Pitch":44,"Duration":4}],"452":[{"Pitch":52,"Duration":4}],"456":[{"Pitch":66,"Duration":4},{"Pitch":51,"Duration":4}],"460":[{"Pitch":68,"Duration":4},{"Pitch":52,"Duration":4}],"464":[{"Pitch":69,"Duration":8},{"Pitch":49,"Duration":4}],"468":[{"Pitch":52,"Duration":4}],"472":[{"Pitch":68,"Duration":8},{"Pitch":47,"Duration":4}],"476":[{"Pitch":52,"Duration":4}],"480":[{"Pitch":66,"Duration":8},{"Pitch":45,"Duration":4}],"484":[{"Pitch":52,"Duration":4}],"488":[{"Pitch":71,"Duration":8},{"Pitch":44,"Duration":4}],"492":[{"Pitch":52,"Duration":4}],"496":[{"Pitch":69,"Duration":8},{"Pitch":42,"Duration":4}],"500":[{"Pitch":52,"Duration":4}],"504":[{"Pitch":68,"Duration":8},{"Pitch":40,"Duration":4}],"508":[{"Pitch":52,"Duration":4}],"512":[{"Pitch":66,"Duration":8},{"Pitch":47,"Duration":4}],"516":[{"Pitch":51,"Duration":4}],"520":[{"Pitch":64,"Duration":4},{"Pitch":49,"Duration":4}],"524":[{"Pitch":66,"Duration":4},{"Pitch":51,"Duration":4}],"528":[{"Pitch":68,"Duration":8},{"Pitch":52,"Duration":4}],"532":[{"Pitch":47,"Duration":4}],"536":[{"Pitch":66,"Duration":8},{"Pitch":54,"Duration":4}],"540":[{"Pitch":47,"Duration":4}],"544":[{"Pitch":64,"Duration":8},{"Pitch":56,"Duration":4}],"548":[{"Pitch":47,"Duration":4}],"552":[{"Pitch":76,"Duration":8},{"Pitch":58,"Duration":4}],"556":[{"Pitch":47,"Duration":4}],"560":[{"Pitch":75,"Duration":4},{"Pitch":59,"Duration":8}],"564":[{"Pitch":73,"Duration":4}],"568":[{"Pitch":75,"Duration":4},{"Pitch":56,"Duration":8}],"572":[{"Pitch":76,"Duration":4}],"576":[{"Pitch":78,"Duration":4},{"Pitch":51,"Duration":8}],"580":[{"Pitch":76,"Duration":4}],"584":[{"Pitch":80,"Duration":4},{"Pitch":47,"Duration":8}],"588":[{"Pitch":78,"Duration":4}],"592":[{"Pitch":76,"Duration":4},{"Pitch":54,"Duration":8}],"596":[{"Pitch":75,"Duration":4}],"600":[{"Pitch":73,"Duration":1},{"Pitch":42,"Duration":8}],"601":[{"Pitch":75,"Duration":2}],"603":[{"Pitch":73,"Duration":1}],"604":[{"Pitch":71,"Duration":4}],"608":[{"Pitch":71,"Duration":30},{"Pitch":47,"Duration":15}],"612":[{"Pitch":66,"Duration":4}],"616":[{"Pitch":63,"Duration":4}],"620":[{"Pitch":59,"Duration":19}],"624":[{"Pitch":35,"Duration":15}],"640":[{"Pitch":49,"Duration":4}],"644":[{"Pitch":64,"Duration":4}],"648":[{"Pitch":71,"Duration":8},{"Pitch":63,"Duration":4}],"652":[{"Pitch":64,"Duration":4}],"656":[{"Pitch":76,"Duration":8},{"Pitch":56,"Duration":4}],"660":[{"Pitch":64,"Duration":4}],"664":[{"Pitch":71,"Duration":8},{"Pitch":63,"Duration":4}],"668":[{"Pitch":64,"Duration":4}],"672":[{"Pitch":73,"Duration":8},{"Pitch":57,"Duration":4}],"676":[{"Pitch":64,"Duration":4}],"680":[{"Pitch":69,"Duration":8},{"Pitch":66,"Duration":4}],"684":[{"Pitch":64,"Duration":4}],"688":[{"Pitch":66,"Duration":8},{"Pitch":63,"Duration":4}],"692":[{"Pitch":61,"Duration":4}],"696":[{"Pitch":71,"Duration":8},{"Pitch":59,"Duration":4}],"700":[{"Pitch":57,"Duration":4}],"704":[{"Pitch":64,"Duration":8},{"Pitch":56,"Duration":4}],"708":[{"Pitch":64,"Duration":4}],"712":[{"Pitch":66,"Duration":4},{"Pitch":63,"Duration":4}],"716":[{"Pitch":68,"Duration":4},{"Pitch":64,"Duration":4}],"720":[{"Pitch":69,"Duration":8},{"Pitch":61,"Duration":4}],"724":[{"Pitch":64,"Duration":4}],"728":[{"Pitch":68,"Duration":8},{"Pitch":59,"Duration":4}],"732":[{"Pitch":64,"Duration":4}],"736":[{"Pitch":66,"Duration":8},{"Pitch":57,"Duration":4}],"740":[{"Pitch":64,"Duration":4}],"744":[{"Pitch":71,"Duration":8},{"Pitch":56,"Duration":4}],"748":[{"Pitch":64,"Duration":4}],"752":[{"Pitch":69,"Duration":8},{"Pitch":54,"Duration":4}],"756":[{"Pitch":64,"Duration":4}],"760":[{"Pitch":68,"Duration":8},{"Pitch":52,"Duration":4}],"764":[{"Pitch":64,"Duration":4}],"768":[{"Pitch":66,"Duration":4},{"Pitch":63,"Duration":2}],"772":[{"Pitch":71,"Duration":4}],"776":[{"Pitch":70,"Duration":4},{"Pitch":54,"Duration":8}],"780":[{"Pitch":71,"Duration":4}],"784":[{"Pitch":63,"Duration":4},{"Pitch":59,"Duration":8}],"788":[{"Pitch":71,"Duration":4}],"792":[{"Pitch":70,"Duration":4},{"Pitch":54,"Duration":8}],"796":[{"Pitch":71,"Duration":4}],"800":[{"Pitch":64,"Duration":4},{"Pitch":56,"Duration":8}],"804":[{"Pitch":71,"Duration":4}],"808":[{"Pitch":73,"Duration":4},{"Pitch":52,"Duration":8}],"812":[{"Pitch":71,"Duration":4}],"816":[{"Pitch":70,"Duration":4},{"Pitch":49,"Duration":8}],"820":[{"Pitch":68,"Duration":4}],"824":[{"Pitch":66,"Duration":4},{"Pitch":54,"Duration":8}],"828":[{"Pitch":64,"Duration":4}],"832":[{"Pitch":63,"Duration":4},{"Pitch":47,"Duration":8}],"836":[{"Pitch":71,"Duration":4}],"840":[{"Pitch":70,"Duration":4},{"Pitch":49,"Duration":4}],"844":[{"Pitch":71,"Duration":4},{"Pitch":51,"Duration":4}],"848":[{"Pitch":68,"Duration":4},{"Pitch":52,"Duration":8}],"852":[{"Pitch":71,"Duration":4}],"856":[{"Pitch":66,"Duration":4},{"Pitch":51,"Duration":8}],"860":[{"Pitch":71,"Duration":4}],"864":[{"Pitch":64,"Duration":4},{"Pitch":49,"Duration":8}],"868":[{"Pitch":71,"Duration":4}],"872":[{"Pitch":63,"Duration":4},{"Pitch":54,"Duration":8}],"876":[{"Pitch":71,"Duration":4}],"880":[{"Pitch":61,"Duration":4},{"Pitch":52,"Duration":8}],"884":[{"Pitch":71,"Duration":4}],"888":[{"Pitch":59,"Duration":4},{"Pitch":51,"Duration":8}],"892":[{"Pitch":71,"Duration":4}],"896":[{"Pitch":70,"Duration":2},{"Pitch":49,"Duration":4}],"900":[{"Pitch":54,"Duration":4}],"904":[{"Pitch":73,"Duration":8},{"Pitch":52,"Duration":4}],"908":[{"Pitch":54,"Duration":4}],"912":[{"Pitch":78,"Duration":8},{"Pitch":51,"Duration":4}],"916":[{"Pitch":54,"Duration":4}],"920":[{"Pitch":73,"Duration":8},{"Pitch":52,"Duration":4}],"924":[{"Pitch":54,"Duration":4}],"928":[{"Pitch":75,"Duration":8},{"Pitch":48,"Duration":4}],"932":[{"Pitch":54,"Duration":4}],"936":[{"Pitch":72,"Duration":8},{"Pitch":56,"Duration":4}],"940":[{"Pitch":54,"Duration":4}],"944":[{"Pitch":68,"Duration":8},{"Pitch":52,"Duration":4}],"948":[{"Pitch":51,"Duration":4}],"952":[{"Pitch":78,"Duration":8},{"Pitch":49,"Duration":4}],"956":[{"Pitch":48,"Duration":4}],"960":[{"Pitch":76,"Duration":4},{"Pitch":49,"Duration":8}],"964":[{"Pitch":81,"Duration":4}],"968":[{"Pitch":80,"Duration":4},{"Pitch":52,"Duration":8}],"972":[{"Pitch":81,"Duration":4}],"976":[{"Pitch":78,"Duration":4},{"Pitch":57,"Duration":8}],"980":[{"Pitch":81,"Duration":4}],"984":[{"Pitch":80,"Duration":4},{"Pitch":52,"Duration":8}],"988":[{"Pitch":81,"Duration":4}],"992":[{"Pitch":75,"Duration":4},{"Pitch":54,"Duration":8}],"996":[{"Pitch":81,"Duration":4}],"1000":[{"Pitch":83,"Duration":4},{"Pitch":51,"Duration":8}],"1004":[{"Pitch":81,"Duration":4}],"1008":[{"Pitch":80,"Duration":4},{"Pitch":47,"Duration":8}],"1012":[{"Pitch":78,"Duration":4}],"1016":[{"Pitch":76,"Duration":4},{"Pitch":57,"Duration":8}],"1020":[{"Pitch":75,"Duration":4}],"1024":[{"Pitch":76,"Duration":2},{"Pitch":56,"Duration":4}],"1028":[{"Pitch":52,"Duration":4}],"1032":[{"Pitch":71,"Duration":8},{"Pitch":51,"Duration":4}],"1036":[{"Pitch":52,"Duration":4}],"1040":[{"Pitch":76,"Duration":8},{"Pitch":49,"Duration":4}],"1044":[{"Pitch":52,"Duration":4}],"1048":[{"Pitch":71,"Duration":8},{"Pitch":51,"Duration":4}],"1052":[{"Pitch":52,"Duration":4}],"1056":[{"Pitch":73,"Duration":8},{"Pitch":45,"Duration":4}],"1060":[{"Pitch":52,"Duration":4}],"1064":[{"Pitch":69,"Duration":8},{"Pitch":54,"Duration":4}],"1068":[{"Pitch":52,"Duration":4}],"1072":[{"Pitch":66,"Duration":8},{"Pitch":51,"Duration":4}],"1076":[{"Pitch":49,"Duration":4}],"1080":[{"Pitch":71,"Duration":8},{"Pitch":47,"Duration":4}],"1084":[{"Pitch":45,"Duration":4}],"1088":[{"Pitch":64,"Duration":8},{"Pitch":44,"Duration":4}],"1092":[{"Pitch":52,"Duration":4}],"1096":[{"Pitch":66,"Duration":4},{"Pitch":51,"Duration":4}],"1100":[{"Pitch":68,"Duration":4},{"Pitch":52,"Duration":4}],"1104":[{"Pitch":69,"Duration":8},{"Pitch":49,"Duration":4}],"1108":[{"Pitch":52,"Duration":4}],"1112":[{"Pitch":68,"Duration":8},{"Pitch":47,"Duration":4}],"1116":[{"Pitch":52,"Duration":4}],"1120":[{"Pitch":66,"Duration":8},{"Pitch":45,"Duration":4}],"1124":[{"Pitch":52,"Duration":4}],"1128":[{"Pitch":71,"Duration":8},{"Pitch":44,"Duration":4}],"1132":[{"Pitch":52,"Duration":4}],"1136":[{"Pitch":69,"Duration":8},{"Pitch":42,"Duration":4}],"1140":[{"Pitch":52,"Duration":4}],"1144":[{"Pitch":68,"Duration":8},{"Pitch":40,"Duration":4}],"1148":[{"Pitch":52,"Duration":4}],"1152":[{"Pitch":66,"Duration":8},{"Pitch":47,"Duration":4}],"1156":[{"Pitch":51,"Duration":4}],"1160":[{"Pitch":64,"Duration":4},{"Pitch":49,"Duration":4}],"1164":[{"Pitch":66,"Duration":4},{"Pitch":51,"Duration":4}],"1168":[{"Pitch":68,"Duration":8},{"Pitch":52,"Duration":4}],"1172":[{"Pitch":47,"Duration":4}],"1176":[{"Pitch":66,"Duration":8},{"Pitch":54,"Duration":4}],"1180":[{"Pitch":47,"Duration":4}],"1184":[{"Pitch":64,"Duration":8},{"Pitch":56,"Duration":4}],"1188":[{"Pitch":47,"Duration":4}],"1192":[{"Pitch":76,"Duration":8},{"Pitch":58,"Duration":4}],"1196":[{"Pitch":47,"Duration":4}],"1200":[{"Pitch":75,"Duration":4},{"Pitch":59,"Duration":8}],"1204":[{"Pitch":73,"Duration":4}],"1208":[{"Pitch":75,"Duration":4},{"Pitch":56,"Duration":8}],"1212":[{"Pitch":76,"Duration":4}],"1216":[{"Pitch":78,"Duration":4},{"Pitch":51,"Duration":8}],"1220":[{"Pitch":76,"Duration":4}],"1224":[{"Pitch":80,"Duration":4},{"Pitch":47,"Duration":8}],"1228":[{"Pitch":78,"Duration":4}],"1232":[{"Pitch":76,"Duration":4},{"Pitch":54,"Duration":8}],"1236":[{"Pitch":75,"Duration":4}],"1240":[{"Pitch":73,"Duration":1},{"Pitch":42,"Duration":8}],"1241":[{"Pitch":75,"Duration":2}],"1243":[{"Pitch":73,"Duration":1}],"1244":[{"Pitch":71,"Duration":4}],"1248":[{"Pitch":71,"Duration":30},{"Pitch":47,"Duration":15}],"1252":[{"Pitch":66,"Duration":4}],"1256":[{"Pitch":63,"Duration":4}],"1260":[{"Pitch":59,"Duration":19}],"1264":[{"Pitch":35,"Duration":15}],"1280":[{"Pitch":47,"Duration":8}],"1284":[{"Pitch":66,"Duration":4}],"1288":[{"Pitch":64,"Duration":4},{"Pitch":54,"Duration":8}],"1292":[{"Pitch":66,"Duration":4}],"1296":[{"Pitch":63,"Duration":4},{"Pitch":59,"Duration":8}],"1300":[{"Pitch":66,"Duration":4}],"1304":[{"Pitch":71,"Duration":4},{"Pitch":54,"Duration":8}],"1308":[{"Pitch":68,"Duration":4}],"1312":[{"Pitch":69,"Duration":4},{"Pitch":51,"Duration":8}],"1316":[{"Pitch":66,"Duration":4}],"1320":[{"Pitch":64,"Duration":4},{"Pitch":54,"Duration":8}],"1324":[{"Pitch":66,"Duration":4}],"1328":[{"Pitch":63,"Duration":4},{"Pitch":47,"Duration":8}],"1332":[{"Pitch":66,"Duration":4}],"1336":[{"Pitch":69,"Duration":4},{"Pitch":51,"Duration":8}],"1340":[{"Pitch":66,"Duration":4}],"1344":[{"Pitch":68,"Duration":8},{"Pitch":52,"Duration":4}],"1348":[{"Pitch":59,"Duration":4}],"1352":[{"Pitch":66,"Duration":4},{"Pitch":57,"Duration":4}],"1356":[{"Pitch":68,"Duration":4},{"Pitch":59,"Duration":4}],"1360":[{"Pitch":64,"Duration":8},{"Pitch":56,"Duration":4}],"1364":[{"Pitch":59,"Duration":4}],"1368":[{"Pitch":71,"Duration":8},{"Pitch":64,"Duration":4}],"1372":[{"Pitch":61,"Duration":4}],"1376":[{"Pitch":68,"Duration":8},{"Pitch":62,"Duration":4}],"1380":[{"Pitch":59,"Duration":4}],"1384":[{"Pitch":71,"Duration":8},{"Pitch":57,"Duration":4}],"1388":[{"Pitch":59,"Duration":4}],"1392":[{"Pitch":64,"Duration":8},{"Pitch":56,"Duration":4}],"1396":[{"Pitch":59,"Duration":4}],"1400":[{"Pitch":68,"Duration":8},{"Pitch":62,"Duration":4}],"1404":[{"Pitch":59,"Duration":4}],"1408":[{"Pitch":69,"Duration":8},{"Pitch":61,"Duration":4}],"1412":[{"Pitch":57,"Duration":4}],"1416":[{"Pitch":73,"Duration":8},{"Pitch":56,"Duration":4}],"1420":[{"Pitch":57,"Duration":4}],"1424":[{"Pitch":81,"Duration":20},{"Pitch":54,"Duration":4}],"1428":[{"Pitch":57,"Duration":4}],"1432":[{"Pitch":61,"Duration":4}],"1436":[{"Pitch":57,"Duration":4}],"1440":[{"Pitch":59,"Duration":4}],"1444":[{"Pitch":71,"Duration":4},{"Pitch":56,"Duration":4}],"1448":[{"Pitch":69,"Duration":4},{"Pitch":54,"Duration":4}],"1452":[{"Pitch":71,"Duration":4},{"Pitch":56,"Duration":4}],"1456":[{"Pitch":80,"Duration":24},{"Pitch":53,"Duration":4}],"1460":[{"Pitch":56,"Duration":4}],"1464":[{"Pitch":59,"Duration":4}],"1468":[{"Pitch":56,"Duration":4}],"1472":[{"Pitch":57,"Duration":4}],"1476":[{"Pitch":54,"Duration":4}],"1480":[{"Pitch":73,"Duration":8},{"Pitch":53,"Duration":4}],"1484":[{"Pitch":54,"Duration":4}],"1488":[{"Pitch":78,"Duration":8},{"Pitch":50,"Duration":4}],"1492":[{"Pitch":54,"Duration":4}],"1496":[{"Pitch":73,"Duration":8},{"Pitch":53,"Duration":4}],"1500":[{"Pitch":54,"Duration":4}],"1504":[{"Pitch":74,"Duration":8},{"Pitch":47,"Duration":4}],"1508":[{"Pitch":54,"Duration":4}],"1512":[{"Pitch":71,"Duration":8},{"Pitch":53,"Duration":4}],"1516":[{"Pitch":54,"Duration":4}],"1520":[{"Pitch":68,"Duration":8},{"Pitch":49,"Duration":4}],"1524":[{"Pitch":61,"Duration":4}],"1528":[{"Pitch":77,"Duration":8},{"Pitch":59,"Duration":4}],"1532":[{"Pitch":61,"Duration":4}],"1536":[{"Pitch":78,"Duration":4},{"Pitch":57,"Duration":8}],"1540":[{"Pitch":73,"Duration":4}],"1544":[{"Pitch":71,"Duration":4},{"Pitch":61,"Duration":8}],"1548":[{"Pitch":73,"Duration":4}],"1552":[{"Pitch":69,"Duration":4},{"Pitch":66,"Duration":8}],"1556":[{"Pitch":73,"Duration":4}],"1560":[{"Pitch":78,"Duration":4},{"Pitch":61,"Duration":8}],"1564":[{"Pitch":75,"Duration":4}],"1568":[{"Pitch":76,"Duration":4},{"Pitch":58,"Duration":8}],"1572":[{"Pitch":73,"Duration":4}],"1576":[{"Pitch":71,"Duration":4},{"Pitch":61,"Duration":8}],"1580":[{"Pitch":73,"Duration":4}],"1584":[{"Pitch":70,"Duration":4},{"Pitch":54,"Duration":8}],"1588":[{"Pitch":73,"Duration":4}],"1592":[{"Pitch":76,"Duration":4},{"Pitch":58,"Duration":8}],"1596":[{"Pitch":73,"Duration":4}],"1600":[{"Pitch":75,"Duration":8},{"Pitch":59,"Duration":4}],"1604":[{"Pitch":54,"Duration":4}],"1608":[{"Pitch":73,"Duration":4},{"Pitch":52,"Duration":4}],"1612":[{"Pitch":75,"Duration":4},{"Pitch":54,"Duration":4}],"1616":[{"Pitch":71,"Duration":8},{"Pitch":51,"Duration":4}],"1620":[{"Pitch":54,"Duration":4}],"1624":[{"Pitch":78,"Duration":8},{"Pitch":59,"Duration":4}],"1628":[{"Pitch":56,"Duration":4}],"1632":[{"Pitch":75,"Duration":8},{"Pitch":57,"Duration":4}],"1636":[{"Pitch":54,"Duration":4}],"1640":[{"Pitch":78,"Duration":8},{"Pitch":52,"Duration":4}],"1644":[{"Pitch":54,"Duration":4}],"1648":[{"Pitch":71,"Duration":8},{"Pitch":51,"Duration":4}],"1652":[{"Pitch":54,"Duration":4}],"1656":[{"Pitch":75,"Duration":8},{"Pitch":57,"Duration":4}],"1660":[{"Pitch":54,"Duration":4}],"1664":[{"Pitch":76,"Duration":4},{"Pitch":56,"Duration":8}],"1668":[{"Pitch":71,"Duration":4}],"1672":[{"Pitch":69,"Duration":4},{"Pitch":59,"Duration":8}],"1676":[{"Pitch":71,"Duration":4}],"1680":[{"Pitch":68,"Duration":4},{"Pitch":64,"Duration":8}],"1684":[{"Pitch":71,"Duration":4}],"1688":[{"Pitch":74,"Duration":4},{"Pitch":56,"Duration":8}],"1692":[{"Pitch":71,"Duration":4}],"1696":[{"Pitch":73,"Duration":4},{"Pitch":57,"Duration":8}],"1700":[{"Pitch":69,"Duration":4}],"1704":[{"Pitch":68,"Duration":4},{"Pitch":61,"Duration":8}],"1708":[{"Pitch":69,"Duration":4}],"1712":[{"Pitch":66,"Duration":4},{"Pitch":63,"Duration":8}],"1716":[{"Pitch":69,"Duration":4}],"1720":[{"Pitch":73,"Duration":4},{"Pitch":54,"Duration":8}],"1724":[{"Pitch":69,"Duration":4}],"1728":[{"Pitch":71,"Duration":4},{"Pitch":56,"Duration":8}],"1732":[{"Pitch":68,"Duration":4}],"1736":[{"Pitch":66,"Duration":4},{"Pitch":59,"Duration":8}],"1740":[{"Pitch":68,"Duration":4}],"1744":[{"Pitch":64,"Duration":4},{"Pitch":61,"Duration":8}],"1748":[{"Pitch":68,"Duration":4}],"1752":[{"Pitch":71,"Duration":4},{"Pitch":52,"Duration":8}],"1756":[{"Pitch":68,"Duration":4}],"1760":[{"Pitch":69,"Duration":4},{"Pitch":54,"Duration":8}],"1764":[{"Pitch":66,"Duration":4}],"1768":[{"Pitch":64,"Duration":4},{"Pitch":57,"Duration":8}],"1772":[{"Pitch":66,"Duration":4}],"1776":[{"Pitch":63,"Duration":4},{"Pitch":59,"Duration":8}],"1780":[{"Pitch":66,"Duration":4}],"1784":[{"Pitch":69,"Duration":4},{"Pitch":51,"Duration":8}],"1788":[{"Pitch":66,"Duration":4}],"1792":[{"Pitch":68,"Duration":8},{"Pitch":52,"Duration":4}],"1796":[{"Pitch":59,"Duration":4}],"1800":[{"Pitch":66,"Duration":4},{"Pitch":64,"Duration":4}],"1804":[{"Pitch":68,"Duration":4},{"Pitch":63,"Duration":4}],"1808":[{"Pitch":69,"Duration":4},{"Pitch":61,"Duration":4}],"1812":[{"Pitch":68,"Duration":4},{"Pitch":59,"Duration":4}],"1816":[{"Pitch":66,"Duration":4},{"Pitch":57,"Duration":4}],"1820":[{"Pitch":64,"Duration":4},{"Pitch":56,"Duration":4}],"1824":[{"Pitch":73,"Duration":8},{"Pitch":57,"Duration":4}],"1828":[{"Pitch":56,"Duration":4}],"1832":[{"Pitch":76,"Duration":2},{"Pitch":54,"Duration":4}],"1834":[{"Pitch":75,"Duration":2}],"1836":[{"Pitch":73,"Duration":2},{"Pitch":57,"Duration":4}],"1838":[{"Pitch":75,"Duration":2}],"1840":[{"Pitch":76,"Duration":31},{"Pitch":56,"Duration":4}],"1844":[{"Pitch":64,"Duration":4}],"1848":[{"Pitch":71,"Duration":8},{"Pitch":63,"Duration":4}],"1852":[{"Pitch":64,"Duration":4}],"1856":[{"Pitch":73,"Duration":8},{"Pitch":57,"Duration":4}],"1860":[{"Pitch":64,"Duration":4}],"1864":[{"Pitch":69,"Duration":8},{"Pitch":63,"Duration":4}],"1868":[{"Pitch":64,"Duration":4}],"1872":[{"Pitch":75,"Duration":15},{"Pitch":66,"Duration":8},{"Pitch":59,"Duration":8}],"1880":[{"Pitch":71,"Duration":8},{"Pitch":47,"Duration":8}],"1888":[{"Pitch":76,"Duration":30},{"Pitch":68,"Duration":30},{"Pitch":52,"Duration":4}],"1892":[{"Pitch":40,"Duration":4}],"1896":[{"Pitch":44,"Duration":4}],"1900":[{"Pitch":47,"Duration":4}],"1904":[{"Pitch":52,"Duration":15}],"1920":[{"Pitch":47,"Duration":8}],"1924":[{"Pitch":66,"Duration":4}],"1928":[{"Pitch":64,"Duration":4},{"Pitch":54,"Duration":8}],"1932":[{"Pitch":66,"Duration":4}],"1936":[{"Pitch":63,"Duration":4},{"Pitch":59,"Duration":8}],"1940":[{"Pitch":66,"Duration":4}],"1944":[{"Pitch":71,"Duration":4},{"Pitch":54,"Duration":8}],"1948":[{"Pitch":68,"Duration":4}],"1952":[{"Pitch":69,"Duration":4},{"Pitch":51,"Duration":8}],"1956":[{"Pitch":66,"Duration":4}],"1960":[{"Pitch":64,"Duration":4},{"Pitch":54,"Duration":8}],"1964":[{"Pitch":66,"Duration":4}],"1968":[{"Pitch":63,"Duration":4},{"Pitch":47,"Duration":8}],"1972":[{"Pitch":66,"Duration":4}],"1976":[{"Pitch":69,"Duration":4},{"Pitch":51,"Duration":8}],"1980":[{"Pitch":66,"Duration":4}],"1984":[{"Pitch":68,"Duration":8},{"Pitch":52,"Duration":4}],"1988":[{"Pitch":59,"Duration":4}],"1992":[{"Pitch":66,"Duration":4},{"Pitch":57,"Duration":4}],"1996":[{"Pitch":68,"Duration":4},{"Pitch":59,"Duration":4}],"2000":[{"Pitch":64,"Duration":8},{"Pitch":56,"Duration":4}],"2004":[{"Pitch":59,"Duration":4}],"2008":[{"Pitch":71,"Duration":8},{"Pitch":64,"Duration":4}],"2012":[{"Pitch":61,"Duration":4}],"2016":[{"Pitch":68,"Duration":8},{"Pitch":62,"Duration":4}],"2020":[{"Pitch":59,"Duration":4}],"2024":[{"Pitch":71,"Duration":8},{"Pitch":57,"Duration":4}],"2028":[{"Pitch":59,"Duration":4}],"2032":[{"Pitch":64,"Duration":8},{"Pitch":56,"Duration":4}],"2036":[{"Pitch":59,"Duration":4}],"2040":[{"Pitch":68,"Duration":8},{"Pitch":62,"Duration":4}],"2044":[{"Pitch":59,"Duration":4}],"2048":[{"Pitch":69,"Duration":8},{"Pitch":61,"Duration":4}],"2052":[{"Pitch":57,"Duration":4}],"2056":[{"Pitch":73,"Duration":8},{"Pitch":56,"Duration":4}],"2060":[{"Pitch":57,"Duration":4}],"2064":[{"Pitch":81,"Duration":20},{"Pitch":54,"Duration":4}],"2068":[{"Pitch":57,"Duration":4}],"2072":[{"Pitch":61,"Duration":4}],"2076":[{"Pitch":57,"Duration":4}],"2080":[{"Pitch":59,"Duration":4}],"2084":[{"Pitch":71,"Duration":4},{"Pitch":56,"Duration":4}],"2088":[{"Pitch":69,"Duration":4},{"Pitch":54,"Duration":4}],"2092":[{"Pitch":71,"Duration":4},{"Pitch":56,"Duration":4}],"2096":[{"Pitch":80,"Duration":24},{"Pitch":53,"Duration":4}],"2100":[{"Pitch":56,"Duration":4}],"2104":[{"Pitch":59,"Duration":4}],"2108":[{"Pitch":56,"Duration":4}],"2112":[{"Pitch":57,"Duration":4}],"2116":[{"Pitch":54,"Duration":4}],"2120":[{"Pitch":73,"Duration":8},{"Pitch":53,"Duration":4}],"2124":[{"Pitch":54,"Duration":4}],"2128":[{"Pitch":78,"Duration":8},{"Pitch":50,"Duration":4}],"2132":[{"Pitch":54,"Duration":4}],"2136":[{"Pitch":73,"Duration":8},{"Pitch":53,"Duration":4}],"2140":[{"Pitch":54,"Duration":4}],"2144":[{"Pitch":74,"Duration":8},{"Pitch":47,"Duration":4}],"2148":[{"Pitch":54,"Duration":4}],"2152":[{"Pitch":71,"Duration":8},{"Pitch":53,"Duration":4}],"2156":[{"Pitch":54,"Duration":4}],"2160":[{"Pitch":68,"Duration":8},{"Pitch":49,"Duration":4}],"2164":[{"Pitch":61,"Duration":4}],"2168":[{"Pitch":77,"Duration":8},{"Pitch":59,"Duration":4}],"2172":[{"Pitch":61,"Duration":4}],"2176":[{"Pitch":78,"Duration":4},{"Pitch":57,"Duration":8}],"2180":[{"Pitch":73,"Duration":4}],"2184":[{"Pitch":71,"Duration":4},{"Pitch":61,"Duration":8}],"2188":[{"Pitch":73,"Duration":4}],"2192":[{"Pitch":69,"Duration":4},{"Pitch":66,"Duration":8}],"2196":[{"Pitch":73,"Duration":4}],"2200":[{"Pitch":78,"Duration":4},{"Pitch":61,"Duration":8}],"2204":[{"Pitch":75,"Duration":4}],"2208":[{"Pitch":76,"Duration":4},{"Pitch":58,"Duration":8}],"2212":[{"Pitch":73,"Duration":4}],"2216":[{"Pitch":71,"Duration":4},{"Pitch":61,"Duration":8}],"2220":[{"Pitch":73,"Duration":4}],"2224":[{"Pitch":70,"Duration":4},{"Pitch":54,"Duration":8}],"2228":[{"Pitch":73,"Duration":4}],"2232":[{"Pitch":76,"Duration":4},{"Pitch":58,"Duration":8}],"2236":[{"Pitch":73,"Duration":4}],"2240":[{"Pitch":75,"Duration":8},{"Pitch":59,"Duration":4}],"2244":[{"Pitch":54,"Duration":4}],"2248":[{"Pitch":73,"Duration":4},{"Pitch":52,"Duration":4}],"2252":[{"Pitch":75,"Duration":4},{"Pitch":54,"Duration":4}],"2256":[{"Pitch":71,"Duration":8},{"Pitch":51,"Duration":4}],"2260":[{"Pitch":54,"Duration":4}],"2264":[{"Pitch":78,"Duration":8},{"Pitch":59,"Duration":4}],"2268":[{"Pitch":56,"Duration":4}],"2272":[{"Pitch":75,"Duration":8},{"Pitch":57,"Duration":4}],"2276":[{"Pitch":54,"Duration":4}],"2280":[{"Pitch":78,"Duration":8},{"Pitch":52,"Duration":4}],"2284":[{"Pitch":54,"Duration":4}],"2288":[{"Pitch":71,"Duration":8},{"Pitch":51,"Duration":4}],"2292":[{"Pitch":54,"Duration":4}],"2296":[{"Pitch":75,"Duration":8},{"Pitch":57,"Duration":4}],"2300":[{"Pitch":54,"Duration":4}],"2304":[{"Pitch":76,"Duration":4},{"Pitch":56,"Duration":8}],"2308":[{"Pitch":71,"Duration":4}],"2312":[{"Pitch":69,"Duration":4},{"Pitch":59,"Duration":8}],"2316":[{"Pitch":71,"Duration":4}],"2320":[{"Pitch":68,"Duration":4},{"Pitch":64,"Duration":8}],"2324":[{"Pitch":71,"Duration":4}],"2328":[{"Pitch":74,"Duration":4},{"Pitch":56,"Duration":8}],"2332":[{"Pitch":71,"Duration":4}],"2336":[{"Pitch":73,"Duration":4},{"Pitch":57,"Duration":8}],"2340":[{"Pitch":69,"Duration":4}],"2344":[{"Pitch":68,"Duration":4},{"Pitch":61,"Duration":8}],"2348":[{"Pitch":69,"Duration":4}],"2352":[{"Pitch":66,"Duration":4},{"Pitch":63,"Duration":8}],"2356":[{"Pitch":69,"Duration":4}],"2360":[{"Pitch":73,"Duration":4},{"Pitch":54,"Duration":8}],"2364":[{"Pitch":69,"Duration":4}],"2368":[{"Pitch":71,"Duration":4},{"Pitch":56,"Duration":8}],"2372":[{"Pitch":68,"Duration":4}],"2376":[{"Pitch":66,"Duration":4},{"Pitch":59,"Duration":8}],"2380":[{"Pitch":68,"Duration":4}],"2384":[{"Pitch":64,"Duration":4},{"Pitch":61,"Duration":8}],"2388":[{"Pitch":68,"Duration":4}],"2392":[{"Pitch":71,"Duration":4},{"Pitch":52,"Duration":8}],"2396":[{"Pitch":68,"Duration":4}],"2400":[{"Pitch":69,"Duration":4},{"Pitch":54,"Duration":8}],"2404":[{"Pitch":66,"Duration":4}],"2408":[{"Pitch":64,"Duration":4},{"Pitch":57,"Duration":8}],"2412":[{"Pitch":66,"Duration":4}],"2416":[{"Pitch":63,"Duration":4},{"Pitch":59,"Duration":8}],"2420":[{"Pitch":66,"Duration":4}],"2424":[{"Pitch":69,"Duration":4},{"Pitch":51,"Duration":8}],"2428":[{"Pitch":66,"Duration":4}],"2432":[{"Pitch":68,"Duration":8},{"Pitch":52,"Duration":4}],"2436":[{"Pitch":59,"Duration":4}],"2440":[{"Pitch":66,"Duration":4},{"Pitch":64,"Duration":4}],"2444":[{"Pitch":68,"Duration":4},{"Pitch":63,"Duration":4}],"2448":[{"Pitch":69,"Duration":4},{"Pitch":61,"Duration":4}],"2452":[{"Pitch":68,"Duration":4},{"Pitch":59,"Duration":4}],"2456":[{"Pitch":66,"Duration":4},{"Pitch":57,"Duration":4}],"2460":[{"Pitch":64,"Duration":4},{"Pitch":56,"Duration":4}],"2464":[{"Pitch":73,"Duration":8},{"Pitch":57,"Duration":4}],"2468":[{"Pitch":56,"Duration":4}],"2472":[{"Pitch":76,"Duration":2},{"Pitch":54,"Duration":4}],"2474":[{"Pitch":75,"Duration":2}],"2476":[{"Pitch":73,"Duration":2},{"Pitch":57,"Duration":4}],"2478":[{"Pitch":75,"Duration":2}],"2480":[{"Pitch":76,"Duration":31},{"Pitch":56,"Duration":4}],"2484":[{"Pitch":64,"Duration":4}],"2488":[{"Pitch":71,"Duration":8},{"Pitch":63,"Duration":4}],"2492":[{"Pitch":64,"Duration":4}],"2496":[{"Pitch":73,"Duration":8},{"Pitch":57,"Duration":4}],"2500":[{"Pitch":64,"Duration":4}],"2504":[{"Pitch":69,"Duration":8},{"Pitch":63,"Duration":4}],"2508":[{"Pitch":64,"Duration":4}],"2512":[{"Pitch":75,"Duration":15},{"Pitch":66,"Duration":8},{"Pitch":59,"Duration":8}],"2520":[{"Pitch":71,"Duration":8},{"Pitch":47,"Duration":8}],"2528":[{"Pitch":76,"Duration":30},{"Pitch":68,"Duration":30},{"Pitch":52,"Duration":4}],"2532":[{"Pitch":40,"Duration":4}],"2536":[{"Pitch":44,"Duration":4}],"2540":[{"Pitch":47,"Duration":4}],"2544":[{"Pitch":52,"Duration":15}]}'
    //var str = "test test";

    //console.log(str, stringLength, actualStringLength);

    //var buf = Module._malloc(actualStringLength);
    //var ptr = allocate(intArrayFromString(str), 'i8', ALLOC_NORMAL)
    //Module.stringToUTF8(str, buf, actualStringLength);
    //Module.HEAPU8.set(stringifiedDictionary, buf);

    //var z = Module.ccall('javascriptWrapperFunction', 'number', ['string'], [str]);

    //Module._free(buf);
    //Module._free(ptr)


}

$( function()
{
	var modelLocalStorageString = "ianbacus.github.io.saves";
	var viewLocalStorageString = "ianbacus.github.io.viewdata";
	var controllerLocalStorageString = "ianbacus.github.io.state";

    var deserializedModelData = JSON.parse(localStorage.getItem(modelLocalStorageString));
	var deserializedViewData = JSON.parse(localStorage.getItem(viewLocalStorageString));
	var deserializedControllerData = JSON.parse(localStorage.getItem(controllerLocalStorageString));

    function OnPageUnload()
    {
        localStorage.setItem(modelLocalStorageString,ScoreModel.Serialize());
		localStorage.setItem(viewLocalStorageString,ScoreView.Serialize());
		localStorage.setItem(controllerLocalStorageString,ScoreController.Serialize());

        return true;
    }

    ScoreModel.Initialize(deserializedModelData);
    ScoreView.Initialize(
		deserializedViewData,
        ScoreController,
        ScoreController.OnKeyUp,
        ScoreController.OnMouseScroll,
        ScoreController.OnMouseMove, ScoreController.OnMouseClickUp, ScoreController.OnMouseClickDown,
        ScoreController.OnHoverBegin, ScoreController.OnHoverEnd,
        ScoreController.OnSliderChange, ScoreController.OnSelectChange,
        OnPageUnload,
        ScoreController.OnRadioButtonPress,
    );

    ScoreController.Initialize(deserializedControllerData);

    testEmscript();
});
