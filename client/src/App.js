import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import { observer } from 'mobx-react';
import logo from './logo.png';
import backgroundImage from './balloon-cow.jpg';
import AdminStore from './stores/AdminStore';
import { AdminPage, RootPage, UserPage } from './pages';
import './App.css';

import AppBar from '@material-ui/core/AppBar';
import ToolBar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import IconButton from '@material-ui/core/IconButton';
import LightModeIcon from '@material-ui/icons/WbSunny';
import DarkModeIcon from '@material-ui/icons/NightsStay';
import Paper from '@material-ui/core/Paper';

import useMediaQuery from '@material-ui/core/useMediaQuery';
import { createMuiTheme, ThemeProvider, withStyles } from '@material-ui/core/styles';
import CssBaseline from '@material-ui/core/CssBaseline';


function App() {

  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  console.log(prefersDarkMode);

  const [darkMode, setDarkMode] = useState(useMediaQuery('(prefers-color-scheme: dark)'));

  const darkTheme = createMuiTheme({
    palette: {
      type: 'dark',
      primary: {
        main: '#92151a'
      },
      secondary: {
        main: '#d7ccc8'
      }
    }
  });

  const lightTheme = createMuiTheme({
    palette: {
      type: 'light',
      primary: {
        main: '#92151a'
      },
      secondary: {
        main: '#d7ccc8'
      }
    }
  });
  
  // Gets current user login status when page loads
  async function fetchInfo() {
    AdminStore.loading = true;
    try {
      const res = await fetch('/admin/status', { method: 'POST' });
      const data = await res.json();

      AdminStore.loggedIn = data.loggedIn;
      AdminStore.email = data.email;
      AdminStore.name = data.name;
      AdminStore.hasPerm = data.hasPerm;

    } catch(e) {
      AdminStore.loggedIn = false;
    }

    AdminStore.loading = false;
  }

  useEffect(() => {
    fetchInfo();
  }, ['']);


  if (AdminStore.loading) return (<div></div>);

  // Redirect to user page if logged in

  return (
    <ThemeProvider theme={!darkMode ? darkTheme : lightTheme}>
      <AppBar position="fixed" style={{opacity:0.9}}>
        <ToolBar>
          <img onClick={() => window.location.href='/'} className="app-logo" src={logo} style={{cursor: 'pointer'}}/>
          <Typography variant="h6">2021牛年春晚抽奖</Typography>
          <IconButton style={{float:"right"}} color="inherit" onClick={() => setDarkMode(!darkMode)} aria-label="Toggle Light/Dark mode">
            {!darkMode ? <DarkModeIcon/> : <LightModeIcon/>}
          </IconButton>
        </ToolBar>
      </AppBar>
      <Router>
        <div className="App">
          <CssBaseline/>
          <Switch>
            <Route exact path="/user/:hash"><UserPage/></Route>
            <Route exact path="/admin"><AdminPage store={AdminStore}/></Route>
            {/* <Route exact path="/signup"><SignupPage/></Route> */}
            {/* <Route exact path="/user"></Route> */}
            <Route exact path="/"><RootPage/></Route>
          </Switch>
        </div>
      </Router>
    </ThemeProvider>
  );
}

const bodyStyle = theme => ({
  "@global": {
    body: {
      background: `url(${backgroundImage}) no-repeat bottom left fixed`,
      // backgroundRepeat: `no-repeat`,
      // backgroundLocation: 'cover'
      backgroundSize: 'cover'
    }
  }
});

export default withStyles(bodyStyle)(observer(App));
