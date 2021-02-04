import React, { useState } from 'react';
import { Form, Field } from 'react-final-form';
import { TextField } from 'final-form-material-ui';
import Typography from '@material-ui/core/Typography';
import Paper from '@material-ui/core/Paper';
import Grid from '@material-ui/core/Grid';
import Button from '@material-ui/core/Button';

const validate = values => {
    const errors = {};
    if (!values.email) {
        errors.email = 'Required';
    }
    else if (!/^([a-zA-Z0-9_\-\.]+)@([a-zA-Z0-9_\-\.]+)\.([a-zA-Z]{2,5})$/.test(values.email)) {
        errors.email = '请确认email格式';
    }

    return errors;
};

export default function RootPage() {
    
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState(false);
    
    async function onSubmit (values) {
        const res = await fetch(`/user/signup`, {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(values)
        });
        const data = await res.json();
        if (data.submitted) setSubmitted(true);
        else if (data.error) setError(true);
    }

    if (submitted) {
        return (
            <div style={{ padding: 16, margin: 'auto', maxWidth: 600, textAlign: "left" }}>
                <Paper style={{ padding: 16, marginTop: 60, opacity: 0.9 }} elevation={16}>
                    <Typography variant="h5" align="center" component="h1" gutterBottom>
                    确认邮件已发送，请查收并点击确认链接
                    </Typography>
                </Paper>
            </div>
        )
    }

    if (error) {
        return (
            <div style={{ padding: 16, margin: 'auto', maxWidth: 600, textAlign: "left" }}>
                <Paper style={{ padding: 16, marginTop: 60, opacity: 0.9 }} elevation={16}>
                    <Typography variant="h5" align="center" component="h1" gutterBottom>
                    发送失败，请重试
                    </Typography>
                    <Button onClick={() => setSubmitted(false), setError(false)}>重新填写</Button>
                </Paper>
            </div>
        )
    }

  return (
    <div style={{ padding: 16, margin: 'auto', maxWidth: 600, textAlign: "left" }}>
      <Form
        onSubmit={onSubmit}
        validate={validate}
        render={({ handleSubmit, submitting, pristine, values }) => (
          <form onSubmit={handleSubmit} noValidate>
            <Paper style={{ padding: 16, marginTop: 60, opacity: 0.9 }} elevation={16}>
              <Typography variant="h5" align="center" component="h1" gutterBottom>
                    填写Email，领取奖券号码
              </Typography>
              <Grid container alignItems="flex-start" spacing={2}>
                <Grid item xs={12}>
                  <Field
                    name="email"
                    fullWidth
                    required
                    component={TextField}
                    type="email"
                    label="Email"
                    placeholder="尽量使用wisc.edu"
                  />
                </Grid>
                <Grid item style={{ marginTop: 16 }}>
                  <Button
                    variant="contained"
                    color="primary"
                    type="submit"
                    disabled={submitting || pristine}
                  >
                    提交
                  </Button>
                </Grid>
              </Grid>
            </Paper>
            {/* <pre>{JSON.stringify(values, 0, 2)}</pre> */}
          </form>
        )}
      />
    </div>
  );
}

