alasql(['CREATE TABLE classes; SELECT * INTO classes FROM CSV("ALL.csv", {headers:true})']);

/*
var r = new XMLHttpRequest();
r.open("GET", "/ALL.csv.gz", true);
r.responseType = "blob";
var blob;
r.onload = function (event) {
  var blob = r.response;
};
r.send();
console.log(blob);

var reader = new FileReader();
var result;
reader.onload = function(event) {
  var result = pako.inflate(event.target.result, { to: 'string' });
  console.log(result);
}
reader.readAsArrayBuffer(blob);
*/

function to_twelve_hour(time) {
  twelve_hour = '';
  if (time < 12) {
    twelve_hour = time + ' AM';
  } else if (time == 12) {
    twelve_hour = time + ' PM';
  } else {
    twelve_hour = (time - 12) + ' PM';
  }
  return twelve_hour;
}

window.get = function() {

  var weekday = new Array("Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday")
  // Get current time 
  var time = new Date();
  const day = time.getDay();
  const hour = time.getHours();
  const minute = time.getMinutes();
  /*
  const day = '1';
  const hour = '8';
  const minute = '30';
  */

  var declare = 'DECLARE @hour int = ' + hour +
                ';DECLARE @minute int = ' + minute +
                ';DECLARE @day int = ' + day +
                ';DECLARE @room_type int = ' + document.getElementById('room-type-select').value +
                ';DECLARE @building varchar(20) = "' + document.getElementById('building-select').value +
                '"';
  alasql(declare);

  
  var selected_rooms = 'SELECT building_name, room_number, room_name, ' + 
    'start_hour, start_minute, room_id FROM classes ' +
    'WHERE ' + 
    'location_type=@room_type AND ' +
    'building = @building';

  rooms_query = alasql(selected_rooms);

  var rooms = new Map();
  rooms_query.forEach(function(element) {
    var val = {};
    val['building_name'] = element['building_name'];
    val['room_name'] = element['room_name'];
    val['start_hour'] = element['start_hour'];
    val['start_minute'] = element['start_minute'];
    val['room_id'] = element['room_id'];
    val['occupied'] = false;
    val['time'] = 25;
    rooms.set(element['room_number'], val);
  });

  var occupied_rooms = 'SELECT room_number FROM classes ' +
    'WHERE ' + 
    'CONVERT(varchar(10), CAST(start_date AS DATETIME)) <= CONVERT(varchar(10), GETDATE()) AND ' +
    'CONVERT(varchar(10), CAST(end_date AS DATETIME)) >= CONVERT(varchar(10), GETDATE()) AND ' +
    'start_hour <= @hour AND ' +
    'end_hour >= @hour AND ' +
    'end_minute >= CASE WHEN end_hour == @hour THEN @minute ELSE end_minute END AND ' +
    'start_minute <= CASE WHEN start_hour == @hour THEN @minute ELSE start_minute END AND ' +
    'day=@day';

  occupied_rooms_query = alasql(occupied_rooms);

  occupied_rooms_query.forEach(function(element) {
    if (rooms.has(element['room_number'])) {
      var val = rooms.get(element['room_number']);
      val['occupied'] = true;
      rooms.set(element['room_number'], val);
    }
  });


  var future_classes ='SELECT room_number, start_hour FROM classes ' +
    'WHERE ' + 
    'CONVERT(varchar(10), CAST(start_date AS DATETIME)) <= CONVERT(varchar(10), GETDATE()) AND ' +
    'CONVERT(varchar(10), CAST(end_date AS DATETIME)) >= CONVERT(varchar(10), GETDATE()) AND ' +
    'start_hour >= @hour AND ' +
    //'end_hour <= @hour AND ' +
    'end_minute <= CASE WHEN end_hour == @hour THEN @minute ELSE end_minute END AND ' +
    'start_minute >= CASE WHEN start_hour == @hour THEN @minute ELSE start_minute END AND ' +
    'day=@day AND ' +
    'location_type=@room_type AND ' +
    'building = @building';

  future_classes_query = alasql(future_classes);

  future_classes_query.forEach(function(element) {
    if (rooms.has(element['room_number'])) {
      var val = rooms.get(element['room_number']) 
      if (val['time'] > element['start_hour']) {
        val['time'] = element['start_hour'];
        rooms.set(element['room_number'], val);
      }
    }
  });

  var card_html = '';
  rooms.forEach(function(value, key, map) {
    var room_status = '';
    if (value['occupied'] == true) {
      room_status = 'Room Occupied';
    } else if (value['time'] == 25) {
      room_status = 'Free';
    } else {
      room_status = 'Free Until ' + to_twelve_hour(value['time']);
    }
    var card = '<div class="card" id=' + value['room_id'] + '>' + 
                 '<div class="card-room">' + key + '</div>' +
                   '<div class="card-room-type">' +
                     '<span class="text">' + value['room_name'] + '</span>' + 
                   '</div>' +
                   '<div class="card-building">' + value['building_name'] + '</div>' +
                   '<div class="main-description">' + room_status + 
                 '</div>' + 
               '</div>';
    card_html += card;
  });
  
  //console.log(rooms);

  document.getElementById('results').innerHTML = card_html;

  function getSchedule(room_id) {
    alasql('DECLARE @room_id int = ' + room_id);
    var scheduled_classes= 'SELECT start_hour, start_minute, end_hour, end_minute,' +
      'course_number, course_name FROM classes ' +
      'WHERE ' + 
      'room_id=@room_id AND ' +
      'CONVERT(varchar(10), CAST(start_date AS DATETIME)) <= CONVERT(varchar(10), GETDATE()) AND ' +
      'CONVERT(varchar(10), CAST(end_date AS DATETIME)) >= CONVERT(varchar(10), GETDATE()) AND ' +
      'day=@day';

    classes_query = alasql(scheduled_classes);
    classes_query.sort(function(a,b){return a.start_hour > b.start_hour});
    //console.log(classes_query);
    return classes_query;
  }

  var modal = document.getElementById("modal_room");

  function toggleModal() {
    modal.classList.toggle("show-modal");
  }

  function add_classes_to_modal(classes) {
    var content = document.getElementsByClassName("modal-content-main")[0];
    if (classes.length == 0) {
      content.innerHTML = "<p>No classes</p>";
    } else {
      var html = "";
      html = '<div class="day-timeline">';
      classes.forEach(function callback(_class) {
        //console.log(_class);
        html += '<div class="day-entry">';
        html += '<div class="course-time">';
        html += to_twelve_hour(_class.start_hour) + ' - ' + to_twelve_hour(_class.end_hour);
        html += '</div>';
        html += '<div class="course">';
        html += '<div class="day-entry-course-number">' + _class.course_number + '</div>'; 
        html += '<div class="day-entry-course">' + _class.course_name + '</div>'; 
        html += '</div>';
        html += '</div>';
      });
      html += '</div>';
      content.innerHTML = html;
    }

    // way to avoid this?
    var modal_close = document.querySelector(".close");
    modal_close.addEventListener("click", toggleModal);
  }

  var divs = document.getElementsByClassName("card");
  for (i in divs) {
    divs[i].onmouseover = function() {
      this.style.cursor = 'pointer';
    };
    divs[i].onmouseleave = function() {
    };
    divs[i].onclick = function() {
      toggleModal();
      //console.log(this.id);
      var classes = getSchedule(this.id);
      add_classes_to_modal(classes);
    };
  }
  
  window.onclick = function(event) {
    if (event.target == modal) {
      toggleModal();
    }
  };

  var modal_close = document.querySelector(".close");
  modal_close.addEventListener("click", toggleModal);

}

