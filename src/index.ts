import express from 'express';
import axios from 'axios';

const app = express();
const PORT = 3000; // Choose the desired port number
const LASTFM_API_KEY = process.env.LASTFM_API_KEY

type Album = {
  name: string
  artist: string
  playcount: number
}

type AlbumByYear = { [year: string]: Album[] }

type LastFMAlbum = {
  name: string
  mbid: string
  artist: {
    name: string
  }
  playcount: string
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const addAlbum = (albumsByYear: AlbumByYear, year: number, album: LastFMAlbum) => {
  if (!albumsByYear[year]) {
    albumsByYear[year] = [];
  }
  albumsByYear[year].push({ name: album.name, artist: album.artist.name, playcount: Number(album.playcount) });
}

app.get('/albums/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const response = await axios.get('http://ws.audioscrobbler.com/2.0/', {
      params: {
        method: 'user.getTopAlbums',
        user: username,
        period: 'overall',
        api_key: LASTFM_API_KEY,
        limit: 200,
        format: 'json'
      }
    });

    const albums = response.data.topalbums.album;
    const albumsByYear: { [year: string]: Album[] } = {};

    // Fetch release date for each album using album.getInfo
    const albumInfoPromises = albums.map(async (album: { playcount: string, mbid: string; name: string, artist: { name: string } }) => {
      const albumInfoResponse = await axios.get('http://ws.audioscrobbler.com/2.0/', {
        params: {
          method: 'album.getInfo',
          artist: album.artist.name,
          album: album.name,
          mbid: album.mbid,
          api_key: LASTFM_API_KEY,
          format: 'json'
        }
      });

      const yearTag = albumInfoResponse.data.album.tags?.tag?.find((tag: { name: string }) => /^\d{4}$/.test(tag.name));
      const year = yearTag?.name;

      addAlbum(albumsByYear, year, album)
    })

    await Promise.all(albumInfoPromises);
    for (const year in albumsByYear) {
      albumsByYear[year].sort((a, b) => b.playcount - a.playcount)
    }

    res.json(albumsByYear);
  }
  catch (error: any) {
    console.error(error)
    console.error('Error:', error.message);
    res.status(500).json({ error: 'An error occurred' });
  }
});

app.get('/reviveAlbums/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const response = await axios.get('http://ws.audioscrobbler.com/2.0/', {
      params: {
        method: 'user.getTopAlbums',
        user: username,
        period: '12month',
        limit: 1000,
        api_key: LASTFM_API_KEY,
        format: 'json'
      }
    });

    const userTopAlbums: LastFMAlbum[] = response.data.topalbums.album;

    const overallResponse = await axios.get('http://ws.audioscrobbler.com/2.0/', {
      params: {
        method: 'user.getTopAlbums',
        user: username,
        period: 'overall',
        limit: 200,
        api_key: LASTFM_API_KEY,
        format: 'json'
      }
    });

    const overallTopAlbums: LastFMAlbum[] = overallResponse.data.topalbums.album;
    const albumsInfo: Album[] = [];

    for (const album of overallTopAlbums) {
      const mbid = album.mbid;
      const artist = album.artist.name
      const albumName = album.name

      const playcount = userTopAlbums.find((userAlbum) => (mbid && userAlbum.mbid === mbid) || (userAlbum.name === albumName && userAlbum.artist.name === artist))?.playcount ?? 0;
      albumsInfo.push({ playcount: Number(playcount), name: albumName, artist: artist });
    }
  
    albumsInfo.sort((a, b) => b.playcount - a.playcount)
  
    res.json(albumsInfo);
  } catch (error: any) {
    console.error('Error:', error.message);
    res.status(500).json({ error: 'An error occurred' });
  }
});

app.get('/artists/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const response = await axios.get('http://ws.audioscrobbler.com/2.0/', {
      params: {
        method: 'user.getTopArtists',
        user: username,
        period: '12month',
        api_key: LASTFM_API_KEY,
        format: 'json'
      }
    });

    const artists = response.data.topartists.artist;

    res.json(artists);
  } catch (error: any) {
    console.error('Error:', error.message);
    res.status(500).json({ error: 'An error occurred' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
