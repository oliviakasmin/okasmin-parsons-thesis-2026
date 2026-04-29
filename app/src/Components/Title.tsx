import Typography from "@mui/material/Typography";

export default function Title() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center"
      }}
    >
      <Typography variant="h1" component="h1" sx={{ m: 0 }}>
        Ceramics <span style={{ fontStyle: "italic", fontWeight: 100 }}>Undressed</span>
      </Typography>
    </div>
  );
}
