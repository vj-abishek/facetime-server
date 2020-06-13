const express = require('express')
const app = express()
const socket = require('socket.io')
const cors = require('cors')
const Sentry = require('@sentry/node');

// //config
// socket.set('transports', ['websocket']);

// crash report from sentry
Sentry.init({ dsn: 'https://19ab08dbd18f498b9fcc1731d685da6a@o400302.ingest.sentry.io/5258617' });

const PORT = process.env.PORT || 3030

//global variables
let users = []
let count

//Middlewares

//For CORS
app.use(cors())

//default route
app.get('/', (req, res) => {
  res.json({ msg: 'This is V3 with qrcode support' })
})

const server = app.listen(PORT, () => {
  console.log('Listening to the port ', PORT)
})

const io = socket(server)

// configuration for websocket instead of polling
io.set('transports', ['websocket']);



io.on('connection', (socket) => {
  console.log('Made connection id:', socket.id)
  count = Object.keys(io.sockets.connected).length
  let obj = {
    id: socket.id,
  }
  users.push(obj)
  console.log('Users value changed :', users)

  io.emit('users', {
    users: users,
    online_users: count,
  })

  //listen for events

  //The other user joined the party
  socket.on('imhere', () => {
    let room = users.filter((id) => id.id === socket.id)
    console.log(room[0].room)
    socket.broadcast.to(room[0].room).emit('imhere')
  })

  //set offer for airdrop
  socket.on('airdropOffer', (peer) => {
    let room = users.filter((id) => id.id === socket.id)

    try {
      if (room[0].room) {
        socket.broadcast.to(room[0].room).emit('backOffer', peer)
      }
    } catch (err) {
      console.log(err)
    }
  })

  //set answer for airdrop
  socket.on('airdropAnswer', (peer) => {
    let room = users.filter((id) => id.id === socket.id)

    try {
      if (room[0].room) {
        socket.broadcast.to(room[0].room).emit('airdropBackAnswer', peer)
      }
    } catch (err) {
      console.log(err)
    }
  })

  // set answer for facetime
  socket.on('answer', (answer) => {
    socket.broadcast.emit('backAnswer', answer)
  })
  //offer for factime
  socket.on('offer', (answer) => {
    socket.broadcast.emit('backOffer', answer)
  })

  //get name of current user
  socket.on('get_user', (ids) => {
    console.log('Socket id', ids)
    let room = users.filter((id) => id.id === ids.id)

    try {
      if (room[0].room) {
        io.sockets.to(ids.id).emit('user', room)
      }
    } catch (error) {
      console.log(error)
    }
  })

  //This is used for accepting the request or to JOIN the room
  socket.on('Join_by_ME', (data) => {
    socket.join(data.room)
    users.filter((id) => {
      if (id.id === data.id) {
        id.room = data.room
      }
    })
    console.log('Changes List:', users)
    let single = users.find((user) => user.id === socket.id)
    console.log('Here are You', single.room)
    io.to(single.room).emit('Joined', {
      msg: 'Sucessfully joined the server',
      room: single.room,
    })

    // console.log('From room:', io.of(`/${data.room}`).clients())
    // io.of(`/`).emit('Joined', { msg: 'Success in sending' })
  })

  //auto room for qrcode
  socket.on('qrcoderoomcreate', (data) => {
    console.log('Created the Link')
    socket.join(data.name)
    users.filter((id) => {
      if (id.id === socket.id) {
        id.room = data.name
      }
    })
    io.to(socket.id).emit('createdRoom')
  })

  //accept the id and create a room for the qrcode
  socket.on('qrcoderoomjoin', (data) => {
    console.log('Scanned the link')
    socket.join(data.name)
    users.filter((id) => {
      if (id.id === socket.id) {
        id.room = data.name
      }
    })
    io.to(data.name).emit('createdJoined')
  })

  //
  socket.on('Passed', () => {
    let single = users.find((user) => user.id === socket.id)
    io.to(single.room).emit('Passed')
  })

  //This is use to create a request
  socket.on('room_name', (data) => {
    socket.join(`${data.room}-${data.id}`)

    //set the room name the user
    users.filter((id) => {
      if (id.id === socket.id) {
        id.room = `${data.room}-${data.id}`
      }
    })
    console.log('Just room:', users)
    let pat_user = users.find((datas) => datas.id === data.id)
    io.sockets.to(pat_user.id).emit('join_room', {
      room: `${data.room}-${data.id}`,
      id: data.id,
      name: data.name,
    })
  })

  //TO create a user or to put the user online
  socket.on('Create_name', (data) => {
    users.filter((id) => {
      if (id.id === socket.id) {
        id.name = data.name
      }
    })

    socket.on('file', (data) => {
      socket.emit('file', data)
    })

    //Emit to all users
    io.emit('users', {
      users: users,
      online_users: count,
    })
    // console.log(users)
  })

  //respond to disconnects
  socket.on('disconnect', () => {
    count--
    users.filter((id, i) => {
      if (id.id === socket.id) {
        users.splice(i, 1)
      }
    })

    console.log('Disconnected user id:', socket.id)
    // console.log('Users value changed: ', users)
    io.emit('users', {
      users: users,
      online_users: count,
    })
  })
})
