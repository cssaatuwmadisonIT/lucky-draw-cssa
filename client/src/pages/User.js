import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Typography from '@material-ui/core/Typography';
import Paper from '@material-ui/core/Paper';
import Button from '@material-ui/core/Button';
import CssBaseline from '@material-ui/core/CssBaseline';

import IconButton from '@material-ui/core/IconButton';
import SwitchIcon from '@material-ui/icons/Autorenew';

import io from 'socket.io-client';

export default function UserPage() {
    const [user, setUser] = useState({});
    const [exists, setExists] = useState(false);
    const [loading, setLoading] = useState(true);
    const [wonPrize, setWonPrize] = useState(false);
    const [prizeConfirmed, setPrizeConfirmed] = useState(false);
    const [scavengerPage, setScavengerPage] = useState(false);
    const [wonScavenger, setWonScavenger] = useState(false);
    const [scavengerConfirmed, setScavengerConfirmed] = useState(false);
    const { hash } = useParams();

    async function fetchInfo() {
        const res = await fetch('/user/' + hash, { method: 'POST' });
        const data = await res.json();
        if (data.user) {
            setUser(data.user);
            setExists(true);
        }

        setLoading(false);
        return data.user;
    }

    // User confirms winning prize
    async function userConfirmPrize() {
      const res = await fetch('/user/confirm_winning_ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/JSON' },
        body: JSON.stringify({
            isScavenger: scavengerPage,
            hash
        })
      });
      const { confirmed } = await res.json();
      if (!confirmed) return checkIfPrizeWon();
      
      if (scavengerPage) setScavengerConfirmed(confirmed);
      else setPrizeConfirmed(confirmed);
    }

    // On socket win message, go back to server to confirm one last time before updating wonPrize state
    async function checkIfPrizeWon() {
      const res = await fetch(`/user/${hash}/check_winning_ticket`);
      const { prizeWon, scavengerWon, prizeConfirmed, scavengerConfirmed, scavengerWonBoolean } = await res.json();

      setWonPrize(prizeWon);
      setWonScavenger(scavengerWonBoolean);
      setPrizeConfirmed(prizeConfirmed);
      setScavengerConfirmed(scavengerConfirmed);
    }


    // User fails to click confirm, so prize expires
    async function prizeExpired() {
      checkIfPrizeWon();
    }

    
    useEffect(() => {
        fetchInfo().then(result => {
            if (result) {
              // Always checks wether user has won prize on load
              checkIfPrizeWon();

              // Socket passive actions
              const socket = io.connect('', {
                query: { room: hash }
              });
              socket.on('prize_won', checkIfPrizeWon);
              socket.on('prize_expire', prizeExpired);
            }
        });
    },[]);

    const SwitchButton = ({float}) => user.isScavengerHunt ? (
      <IconButton
        size="small"
        style={{float}}
        onClick={() => setScavengerPage(!scavengerPage)}><SwitchIcon/>
      </IconButton>
    ) : null;

    const TicketNumberDisplay = () => {
      if (!user.isScavengerHunt || !scavengerPage) return (
        <Typography variant="h1" align="center" component="h1" gutterBottom >
          {user.ticketNum}
        </Typography>
      );

      else return (
        <>
        <Typography variant="h3" align="center" component="h1" gutterBottom>
          {user.ticketStart} ~
        </Typography>
        <Typography variant="h3" align="center" component="h1" gutterBottom>
          ~ {user.ticketEnd}
        </Typography>
        </>
      )
      return null;
    };

    if (loading) return null;
    
    if (!exists) return (
        <div style={{ padding: 16, margin: 'auto', maxWidth: 600, textAlign: "left" }}>
          <CssBaseline/>
          <Typography variant="h4" align="center" component="h1" gutterBottom style={{ paddingTop: 60 }}>
              无法找到该用户
          </Typography>
        </div>
    );

  return (
    <div style={{ padding: 16, margin: 'auto', maxWidth: 600}}>
      <Paper style={{ padding: 16, marginTop: 60, opacity: 0.9 }} elevation={16}>
        <Typography variant="h5" align="center" component="h1" gutterBottom >
          <SwitchButton float="left"/>
          {!user.isScavengerHunt ? '奖券码' : !scavengerPage ? '主奖券码' : 'Scavenger奖券范围' } 
          <SwitchButton float="right"/>
        </Typography>
        <hr style={{opacity:0.2}}/>
        <TicketNumberDisplay/>
        <Typography align="center" component="p" gutterBottom >
          {user.email}
        </Typography>
      </Paper>
      <Paper style={{ padding: 16, marginTop: 30, opacity: 0.9 }} elevation={16}>
        <Typography variant="h5" align="center" component="h1" gutterBottom >
          中奖信息
        </Typography>
        <hr style={{opacity:0.2}}/>
        <Typography variant="h6" align="center" component="h1" gutterBottom >
          {scavengerPage && scavengerConfirmed ||
            !scavengerPage && prizeConfirmed ? '恭喜您成功领奖！' :
            scavengerPage && wonScavenger || !scavengerPage && wonPrize ? '恭喜中奖！请即刻点击确认' : 'pending...'}
        </Typography>
        <Button
          variant="contained"
          color="primary"
          style={{ marginTop: 30 }}
          onClick={userConfirmPrize}
          disabled={scavengerPage && !wonScavenger || !scavengerPage && !wonPrize ||
            scavengerPage && scavengerConfirmed ||!scavengerPage && prizeConfirmed}>
            {scavengerPage && scavengerConfirmed ||
            !scavengerPage && prizeConfirmed ? '已经领奖' :
            scavengerPage && wonScavenger ||
            !scavengerPage && wonPrize ? '确认领奖' :
            '暂未获奖'}</Button>
      </Paper>
    </div>
  );
}
