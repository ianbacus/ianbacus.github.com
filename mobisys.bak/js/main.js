$(function() 
{
$(".nav a").on("click", function(){
   $(".nav").find(".active").removeClass("active");
   $(this).parent().addClass("active");
});

/*
	$.each($('#mainNavbar').find('li'), function() {
		console.log($(this).find('a').attr('href'));
		console.log(window.location.pathname);
        $(this).toggleClass('active', 
            window.location.pathname.indexOf($(this).find('a').attr('href')) > -1);
    }); 
    */
});