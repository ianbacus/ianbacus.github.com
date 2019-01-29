class disabledConsole
{
    constructor() {}
    log() {} //Do nothing
};

let ScoreView = new View();
let ScoreModel = new Model();
let ScoreController = new Controller(ScoreView,ScoreModel);
let TheMidiAbstractionLayer = new MidiAbstractionLayer();

ScoreView.console = new disabledConsole();
ScoreModel.console = new disabledConsole();
ScoreController.console = new disabledConsole();

//TODO: build emscript with -s EXIT_RUNTIME=1
// ScoreView.console = console;
// ScoreModel.console = console;
//ScoreController.console = console;

Dropzone.autoDiscover = false;
Dropzone.options.testDZ = {
    url: "/file-upload",
    paramName: "file", // The name that will be used to transfer the file
    maxFilesize: 200, // MB
    maxFiles: 1,
    acceptedFiles: ".mid,.MID",
    accept: function(file, done)
    {
        var reader = new FileReader();

        // Closure to capture the file information.
        reader.onload = (function(event)
        {
            var midiData = new Uint8Array(event.target.result);
            var array = MidiParser.parse(midiData);
            TheMidiAbstractionLayer.ParseMidiFile(array);

            $(".loader").show();

            setTimeout(function()
            {
                var score = TheMidiAbstractionLayer.ConvertPitchDeltasToScoreModel();
                if(score.length > 0)
                {
                    var lastNote = score[score.length-1];
                    var lastTick = lastNote.StartTimeTicks + lastNote.Duration;

                    ScoreView.GridWidthTicks = lastTick;
                    ScoreModel.Score = score;
                    ScoreModel.MergeSort(ScoreModel.Score);

                    ScoreController.RefreshNotesAndKey();
                }
            }, 20);
			return false;
		});

        reader.readAsArrayBuffer(file);
    },

    init: function()
    {
        this.on("complete", function(file)
        {
            console.log("success")
          $(".dz-success-mark svg").css("background", "green");
          $(".dz-error-mark").css("display", "none");
      });

        this.on("addedfile", function(file)
        {
            this.removeFile(file);
        });

    }
};

//todo: why is this here? scope?
var textFile = null;
function makeTextFile(text)
{
    var data = new Blob([text], {type: 'text/plain'});

    // If we are replacing a previously generated file we need to
    // manually revoke the object URL to avoid memory leaks.

    window.URL.revokeObjectURL(textFile);
    textFile = window.URL.createObjectURL(data);
	window.open(textFile);

    // returns a URL you can use as a href
};

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

        return false;
    }

    ScoreModel.Initialize(deserializedModelData);
    ScoreView.Initialize(
		deserializedViewData,
        ScoreController,
        ScoreController.OnKeyPress,
        ScoreController.OnMouseScroll,
        ScoreController.OnMouseMove, ScoreController.OnMouseClickUp, ScoreController.OnMouseClickDown,
        ScoreController.OnHoverBegin, ScoreController.OnHoverEnd,
        ScoreController.OnSliderChange, ScoreController.OnSelectChange,
        OnPageUnload,
        ScoreController.OnRadioButtonPress,
    );

    ScoreController.Initialize(deserializedControllerData);

    $(".loader").hide();

    TheMidiAbstractionLayer.Initialize();

    //$("#gridbox").addEventListener("dragenter", function(e)
    $(document).on('dragstart','#testDZ', function(e)
    {
        console.log("start")
        lastTarget = e.target; // cache the last target here
        // unhide our dropzone overlay
        document.querySelector("#testDZ").style.visibility = "";
        document.querySelector("#testDZ").style.opacity = 1;
    });

    $(document).on("dragleave", '#testDZ', function(e)
    {
        // this is the magic part. when leaving the window,
        // e.target happens to be exactly what we want: what we cached
        // at the start, the dropzone we dragged into.
        // so..if dragleave target matches our cache, we hide the dropzone.
        console.log("leave")
        if(e.target === lastTarget || e.target === document)
        {
            document.querySelector("#testDZ").style.visibility = "hidden";
            document.querySelector("#testDZ").style.opacity = 0;
            console.log("c")
        }

    });

    // $("#testDZ").dropzone({
    //   url: "/file-upload",
    //   clickable: false
    // });
    var TheDropzone = new Dropzone("#testDZ",
    {
          url: "/file-upload",
          clickable: false
    });

    $("#testDZ").addClass("dropzone");

    //$(document).on('submit', '#TabSettingsForm',
    $('#TabSettingsForm .midi-form-button').click(
		function(event)
		{
            $(".loader").show();
			event.preventDefault();
            var buttonName = $(this).attr("name");
            console.log(buttonName);

            setTimeout(function()
            {
                //console.log(buttonName);
                if(buttonName == "tab")
                {
                    var tabResultData = GenerateTab();

                    if(tabResultData.failureReason == undefined)
                    {
                        makeTextFile(tabResultData);
                    }

                    else
                    {
                        alert(tabResultData.failureReason)
                    }

                    $(".loader").hide();
                }
            }, 10);
			return false;
		});

});
