const Img = ({ url, caption })=>{
    return (

        <div>
            <img src={url}/>
            { caption.length ? <p className="w-full text-center my-3 md:mb-12 text-base text-dark-grey">{caption}</p> : ""}
        </div>

    )
}

const BlogContent = ({ block })=>{
    
    let { type, data } = block;

    if(type == 'paragraph'){
        return <p dangerouslySetInnerHTML={{__html: data.text}}></p>
    }

    if(type == 'header'){
        if(data.level == 3){
            return <h3 className="text-3xl font-bold" dangerouslySetInnerHTML={{__html: data.text}}></h3>
        }
        return <h2 className="text-4xl font-bold" dangerouslySetInnerHTML={{__html: data.text}}></h2>
    }

    if(type == 'image'){
        return <Img url={data.file.url} caption={data.caption}/>
    }

    else{
        return <h1>this is a block</h1>
    }

}

export default BlogContent;