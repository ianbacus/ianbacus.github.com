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




$( function()
{
    var deserializedData = JSON.parse(localStorage.getItem("ianbacus.github.io.saves"));

    function OnPageUnload()
    {
        localStorage.setItem("ianbacus.github.io.saves",ScoreModel.Serialize());
        return true;
    }

    ScoreModel.Initialize(deserializedData);
    ScoreView.Initialize(
        ScoreController,
        ScoreController.OnKeyUp,
        ScoreController.OnMouseScroll,
        ScoreController.OnMouseMove, ScoreController.OnMouseClickUp, ScoreController.OnMouseClickDown,
        ScoreController.OnHoverBegin, ScoreController.OnHoverEnd,
        ScoreController.OnSliderChange, ScoreController.OnSelectChange,
        OnPageUnload,
        ScoreController.OnRadioButtonPress,
    );

    ScoreController.Initialize();
});
