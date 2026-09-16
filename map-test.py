import plotly.graph_objects as go

fig = go.Figure(
    go.Scattergeo(
        go.Scattergeo(
     lon=[position["longitude"]],
     lat=[position["latitude"]],
     mode="markers"
     )
        mode="markers"
    )
)

fig.update_geos(
    projection_type="orthographic",
    showland=True,
    showocean=True,
    showcountries=True,
    showcoastlines=True
)

fig.update_layout(
    title="ISS Tracker",
    height=700,
    width=900
)

fig.show()