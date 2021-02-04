import React, { useState, useEffect } from 'react';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';
import Paper from '@material-ui/core/Paper';
import io from 'socket.io-client';

export default function AdminPage({ store }) {
    const [currentPrize, setCurrentPrize] = useState(0);
    const [prizeWinners, setPrizeWinners] = useState([
        Array(1).fill({}), Array(5).fill({}), Array(2).fill({}), Array(1).fill({})
    ]);
    // const [prizeDrawn, setPrizeDrawn] = useState([ false, false, false, false ]);
    let socket;
    
    const prizeMap = [
        { name: 'Scavenger', prize: 'Nintendo Switch', limit: 1},
        { name: '三等奖', prize: '清空购物车 - $80上限', limit: 5},
        { name: '二等奖', prize: 'Apple AirPods', limit: 2},
        { name: '一等奖', prize: 'Apple iPhone 12', limit: 1}
    ];

    // Check already drawn prizes
    async function checkDrawnPrizes() {
        const res = await fetch('/admin/prizestatus');
        const data = await res.json();

        const scavengerTemp = data.slice(0,1).map(prize => prize.map(obj => ({
            ticketNum: obj.scavengerWon, 
            confirmed: obj.scavengerConfirmed
        })));
        const temp = data.slice(1,4).map(prize => prize.map(obj => ({
            ticketNum: obj.ticketNum,
            confirmed: obj.prizeConfirmed
        })));
        setPrizeWinners([...scavengerTemp, ...temp]);
    }

    useEffect(() => {
        checkDrawnPrizes();
        
        socket = io.connect('', {
            query: { room: 'admin' }
        });
        socket.on('prize_confirm', checkDrawnPrizes);
    }, []);


    // Draw numbers for the current prize
    async function luckyDraw() {
        const res = await fetch('/admin/luckydraw', {
            method: 'POST',
            headers: { 'Content-Type': 'application/JSON' },
            body: JSON.stringify({
                type: currentPrize,
                limit: prizeMap[currentPrize].limit
            })
        });
        const { ticketWon } = await res.json();
        const temp = [...prizeWinners];
        temp[currentPrize] = ticketWon.map(t => ({ ticketNum: t }));

        // Some animation, scrolling numbers
        const animation = setInterval(() => {
            const animateTemp = [...prizeWinners];
            animateTemp[currentPrize] = [];
            for (let i = 0; i < prizeMap[currentPrize].limit; ++i)
                animateTemp[currentPrize].push({
                    ticketNum: (currentPrize === 0 ? 80000 : 60000) + Math.floor(Math.random() * 6000)
                });
            setPrizeWinners(animateTemp);
        }, 10);

        // Display prize winners
        setTimeout(() => { 
            clearInterval(animation);
            setPrizeWinners(temp);
        }, 3000);
    }

    // Redraws prize if user has not confirmed
    async function redraw(subindex) {
        const res = await fetch('/admin/redraw', {
            method: 'POST',
            headers: { 'Content-Type': 'application/JSON' },
            body: JSON.stringify({
                type: currentPrize,
                originalTicket: prizeWinners[currentPrize][subindex].ticketNum
            })
        });
        const { ticketWon } = await res.json();
        const temp = [...prizeWinners];
        temp[currentPrize] = [...temp[currentPrize]];
        temp[currentPrize][subindex] = { ticketNum: ticketWon, confirmed: false };

        // Some animation, scrolling numbers
        const animation = setInterval(() => {
            const animateTemp = [...prizeWinners];
            animateTemp[currentPrize][subindex] = {
                ticketNum: (currentPrize === 0 ? 80000 : 60000) + Math.floor(Math.random() * 6000)
            };

            setPrizeWinners(animateTemp);
        }, 10);

        // Display prize winners
        setTimeout(() => { 
            clearInterval(animation);
            setPrizeWinners(temp);
        }, 3000);
    }

    // // User has confirmed prize
    // async function userConfirmedPrize(ticketNum) {
    //     const temp = [...prizeWinners];
    //     for (let i = 0; i < temp[currentPrize].length; ++i) {
    //         if (ticketNum === temp[currentPrize][i].ticketNum) temp[currentPrize][i].confirmed = true;
    //     }

    //     setPrizeWinners(temp);
    // }
    

    if (!store.loggedIn) return (
        <div>
            <Typography variant="h5" align="center" component="h1" gutterBottom style={{ paddingTop: 80 }}>
                未登录
            </Typography>
            <Button variant="contained" color="primary" href="/admin/login">使用 wisc.edu 邮箱登录</Button>
        </div>
    )

    if (!store.hasPerm) return (
        <div>
            <Typography variant="h5" align="center" component="h1" gutterBottom style={{ paddingTop: 80 }}>
                {store.email} - 无权限
            </Typography>
            <Button variant="contained" color="primary" href="/admin/logout">请您退出登录</Button>
        </div>
    );
    
    return (
        <div style={{ padding: 16, margin: 'auto', maxWidth: 600, /*marginRight: 100*/}}>
            <Paper style={{ padding: 16, marginTop: 60, opacity: 0.9 }} elevation={16}>
                {prizeMap.map((type, index) => (
                    <Button
                        key={index}
                        variant={currentPrize === index ? 'contained' : 'text'}
                        onClick={() => setCurrentPrize(index)}>
                            {type.name}
                    </Button>
                ))}
                <Typography variant="h6" align="center" component="h6" gutterBottom style={{margin: "10px 0px"}}>
                    {prizeMap[currentPrize].prize}（{prizeMap[currentPrize].limit}份）
                </Typography>
                <Button
                    variant="contained"
                    color="primary"
                    disabled={prizeWinners[currentPrize].length > 0}
                    onClick={luckyDraw}>{prizeWinners[currentPrize].length > 0 ? '抽奖结束' : '开始抽奖'}
                </Button>
            </Paper>
            <Paper style={{ padding: 16, marginTop: 10, opacity: 0.9 }} elevation={16}>
                {Array(prizeMap[currentPrize].limit).fill(0).map((_, subindex) => (
                    <Typography key={subindex} variant="h3" align="left" component="h1" gutterBottom style={{marginLeft: 100, marginTop: 25}}>
                        {prizeWinners[currentPrize][subindex] && prizeWinners[currentPrize][subindex].ticketNum || '??????'}
                        <Button
                            style={{marginLeft: 100}}
                            disabled={prizeWinners[currentPrize][subindex] && prizeWinners[currentPrize][subindex].confirmed || !prizeWinners[currentPrize][subindex]}
                            onClick={() => redraw(subindex)}>
                                {prizeWinners[currentPrize][subindex] && prizeWinners[currentPrize][subindex].confirmed ? '已经确认' : '重新抽奖'}
                        </Button>
                    </Typography>
                ))}
            </Paper>
        </div>
    );
}

