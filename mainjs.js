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
});
